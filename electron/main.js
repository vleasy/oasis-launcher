require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const Store = require("electron-store");
// Генерируем ключ шифрования из пути установки (уникален для каждой установки)
const storeKey = crypto.createHash("sha256").update(__dirname + "-oasis-launcher-v1").digest("hex").slice(0, 32);
let store;
try { store = new Store({ encryptionKey: storeKey }); }
catch (e) {
  const configPath = path.join(app.getPath("userData"), "config.json");
  try { fs.unlinkSync(configPath); } catch (_) {}
  store = new Store({ encryptionKey: storeKey });
}

let mainWindow = null;

const BACKEND_PORT = 3000;
const BACKEND_DIR = path.join(__dirname, "..", "oasis-api");
const BACKEND_DIST = path.join(BACKEND_DIR, "dist", "server.js");

const MOD_VERSION = "1.0.0";
const MOD_JAR_NAME = "oasis-visuals.jar";
const OASIS_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, "OasisLauncher")
  : path.join(__dirname, "..", ".oasislauncher");

const INSTALLED_PATH = path.join(OASIS_DIR, "installed.json");
const MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const LIBRARIES_BASE = "https://libraries.minecraft.net/";
const ASSETS_BASE = "https://resources.download.minecraft.net";
const LOCAL_API = `http://localhost:${BACKEND_PORT}`;

// ============================================
// INSTALLED VERSIONS REGISTRY
// ============================================
function readInstalled() {
  try {
    if (!fs.existsSync(INSTALLED_PATH)) return {};
    return JSON.parse(fs.readFileSync(INSTALLED_PATH, "utf-8"));
  } catch { return {}; }
}

function writeInstalled(data) {
  fs.mkdirSync(path.dirname(INSTALLED_PATH), { recursive: true });
  fs.writeFileSync(INSTALLED_PATH, JSON.stringify(data, null, 2));
}

function getInstalledVersion(id) {
  return readInstalled()[id] || null;
}

function setInstalledVersion(id, info) {
  const data = readInstalled();
  data[id] = { ...info, lastLaunchedAt: undefined };
  writeInstalled(data);
}

function touchInstalledLaunched(id) {
  const data = readInstalled();
  if (data[id]) data[id].lastLaunchedAt = new Date().toISOString();
  writeInstalled(data);
}

function removeInstalledVersion(id) {
  const data = readInstalled();
  delete data[id];
  writeInstalled(data);
}

// ============================================
// SERVER — встроенный (embedded) бэкенд
// ============================================
let backendApp = null;

async function startEmbeddedBackend() {
  try {
    // Load backend .env so JWT_ACCESS_SECRET etc. are available
    const backendEnvPath = path.join(BACKEND_DIR, ".env");
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, "utf8");
      for (const line of envContent.split(/\r?\n/)) {
        const m = line.match(/^\s*(\w+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    }
    const { buildApp } = require(path.join(BACKEND_DIR, "dist", "app.js"));
    process.env.PORT = String(BACKEND_PORT);
    process.env.HOST = "127.0.0.1";
    backendApp = await buildApp();
    await backendApp.listen({ port: BACKEND_PORT, host: "127.0.0.1" });
    log(`backend running on port ${BACKEND_PORT}`);
  } catch (e) {
    log(`backend failed to start: ${e.message}`, "ERROR");
  }
}

async function stopEmbeddedBackend() {
  if (backendApp && typeof backendApp.close === 'function') {
    try { await backendApp.close(); } catch (e) { /* ignore */ }
    backendApp = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    frame: false, transparent: true, title: "Oasis Launcher", show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, devTools: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "..", "prototype.html"));
  if (process.env.NODE_ENV === "development" || process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  mainWindow.webContents.on("console-message", (e, level, msg) => log(`[renderer] ${msg}`));
  mainWindow.webContents.on("did-fail-load", (e, code, desc) => log(`load failed: ${code} ${desc}`, "ERROR"));
  mainWindow.on("closed", () => { mainWindow = null; });
}

ipcMain.on("window-minimize", () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on("window-close", () => { if (mainWindow) mainWindow.close(); });

// ============================================
// VDS API (remote server)
// ============================================
const API_URL = process.env.API_URL || "http://89.35.130.57:3000";

function vdsApi(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
  return fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function vdsApiJson(path, options = {}) {
  const res = await vdsApi(path, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

// ============================================
// AUTH IPC
// ============================================
ipcMain.handle("auth-register", async (_event, { email, password }) => {
  try {
    const res = await vdsApiJson("/api/auth/register", {
      method: "POST",
      body: { email, password, nickname: email.split("@")[0] },
    });
    if (res.data?.accessToken) store.set("auth", res.data);
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("auth-login", async (_event, { email, password }) => {
  try {
    const res = await vdsApiJson("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (res.data?.accessToken) store.set("auth", res.data);
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("auth-logout", async () => {
  const auth = store.get("auth");
  if (auth?.refreshToken) {
    try {
      await vdsApiJson("/api/auth/logout", {
        method: "POST", token: auth.accessToken,
        body: { refreshToken: auth.refreshToken },
      });
    } catch (e) { /* ignore */ }
  }
  store.delete("auth");
  return { success: true };
});

ipcMain.handle("auth-check", async () => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/profile", { token: auth.accessToken });
    return { success: true, data: res.data };
  } catch (e) {
    store.delete("auth");
    return { success: false, error: e.message };
  }
});

// ============================================
// ACCOUNTS IPC
// ============================================
ipcMain.handle("get-accounts", async () => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/accounts", { token: auth.accessToken });
    const mapped = (res.data || []).map(a => ({
      id: a.id,
      nickname: a.username || `Player_${a.id.slice(0, 4)}`,
      type: a.type === "microsoft" ? "ms" : "pirate",
      primary: a.isPrimary,
    }));
    return { success: true, data: mapped };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("add-account", async (_event, { nickname, type }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const backendType = type === "ms" ? "microsoft" : "offline";
    const body = backendType === "offline" ? { type: backendType, username: nickname } : { type: backendType };
    const res = await vdsApiJson("/api/accounts", {
      method: "POST", token: auth.accessToken, body,
    });
    const a = res.data;
    return {
      success: true,
      data: {
        id: a.id,
        nickname: a.username || nickname,
        type: a.type === "microsoft" ? "ms" : "pirate",
        primary: a.isPrimary,
      },
    };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("remove-account", async (_event, { id }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    await vdsApiJson(`/api/accounts/${encodeURIComponent(id)}`, {
      method: "DELETE", token: auth.accessToken,
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("set-primary-account", async (_event, { id }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    await vdsApiJson(`/api/accounts/${encodeURIComponent(id)}/primary`, {
      method: "PUT", token: auth.accessToken,
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================
// PROFILE IPC
// ============================================
ipcMain.handle("get-profile", async () => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/profile", { token: auth.accessToken });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("update-profile", async (_event, { nickname, status, bio, favoriteVersionIds }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/profile", {
      method: "PUT", token: auth.accessToken,
      body: { nickname, status, bio, favoriteVersions: favoriteVersionIds },
    });
    // Обновляем локальный nickname при успешном сохранении
    if (res.success && nickname) {
      const authData = store.get("auth");
      if (authData) {
        authData.user = { ...authData.user, nickname };
        store.set("auth", authData);
      }
    }
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("save-profile-local", async (_event, data) => {
  try {
    store.set("profile", data);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("load-profile-local", async () => {
  try {
    const data = store.get("profile");
    return { success: true, data: data || null };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("upload-avatar", async (_event, { dataUrl }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    // Convert data URL to buffer for multipart upload
    const matches = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return { success: false, error: "Invalid image data" };
    const mime = matches[1];
    const ext = mime === "image/png" ? "png" : "jpg";
    const buffer = Buffer.from(matches[2], "base64");
    const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
    const body = [];
    body.push(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="avatar.${ext}"\r\nContent-Type: ${mime}\r\n\r\n`);
    body.push(buffer);
    body.push(`\r\n--${boundary}--\r\n`);
    const res = await fetch(`${API_URL}/api/profile/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.concat(body.map(b => Buffer.isBuffer(b) ? b : Buffer.from(b))),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { success: true, data: json.data };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================
// FRIENDS IPC
// ============================================
ipcMain.handle("search-friends", async (_event, { query }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson(`/api/friends/search?q=${encodeURIComponent(query)}`, { token: auth.accessToken });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("send-friend-request", async (_event, { nickname }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/friends/request", {
      method: "POST", token: auth.accessToken, body: { nickname },
    });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("get-friends", async () => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/friends", { token: auth.accessToken });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("get-friend-requests", async () => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/friends/requests", { token: auth.accessToken });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("accept-friend-request", async (_event, { id }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/friends/accept", {
      method: "POST", token: auth.accessToken, body: { id },
    });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("decline-friend-request", async (_event, { id }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/friends/decline", {
      method: "POST", token: auth.accessToken, body: { id },
    });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("remove-friend", async (_event, { id }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    await vdsApiJson(`/api/friends/${encodeURIComponent(id)}`, {
      method: "DELETE", token: auth.accessToken,
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("block-friend", async (_event, { id }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    await vdsApiJson("/api/friends/block", {
      method: "POST", token: auth.accessToken, body: { userId: id },
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("get-chat-messages", async (_event, { friendId }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson(`/api/friends/chat/${encodeURIComponent(friendId)}`, { token: auth.accessToken });
    return res;
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("friends-chat-send", async (_event, { friendId, content }) => {
  try {
    const auth = store.get("auth");
    const res = await vdsApiJson(`/api/friends/chat/${encodeURIComponent(friendId)}`, {
      method: "POST", token: auth.accessToken, body: { content },
    });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("get-unread-count", async () => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token", count: 0 };
  try {
    const res = await vdsApiJson("/api/friends/unread", { token: auth.accessToken });
    return { success: true, count: res.data?.count || 0 };
  } catch (e) { return { success: false, error: e.message, count: 0 }; }
});

// ============================================
// BUILDS IPC
// ============================================
ipcMain.handle("share-build", async (_event, { mcVersion, versionName, category }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson("/api/builds/share", {
      method: "POST", token: auth.accessToken,
      body: { mcVersion, versionName, category },
    });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("install-shared-build", async (_event, { code }) => {
  const auth = store.get("auth");
  if (!auth?.accessToken) return { success: false, error: "No token" };
  try {
    const res = await vdsApiJson(`/api/builds/shared/${encodeURIComponent(code)}`, { token: auth.accessToken });
    return { success: true, data: res.data };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================
// REMEMBER ME IPC
// ============================================
ipcMain.handle("remember-me-get", async () => {
  try {
    const data = store.get("remember-me");
    if (!data || !data.rememberMe) return { success: false, data: null };
    return { success: true, data };
  } catch { return { success: false, data: null }; }
});

ipcMain.handle("remember-me-set", async (_event, { email, refreshToken, remember }) => {
  try {
    const data = { email, rememberMe: remember };
    if (refreshToken) data.refreshToken = refreshToken;
    store.set("remember-me", data);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("remember-me-clear", async () => {
  try {
    store.delete("remember-me");
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================
// LANGUAGE SETTINGS (persisted via electron-store)
// ============================================
ipcMain.handle("lang-get", async () => {
  try {
    return { success: true, data: store.get("language", "ru") };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("lang-set", async (_event, { lang }) => {
  try {
    store.set("language", lang);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================
// OASIS VISUALS MOD MANAGEMENT
// ============================================
ipcMain.handle("get-mod-status", async () => {
  try {
    const enabled = store.get("mod-oasis-visuals-enabled", false);
    return { success: true, enabled, version: MOD_VERSION };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("set-mod-status", async (_event, { enabled }) => {
  try {
    store.set("mod-oasis-visuals-enabled", enabled);
    const modsDir = path.join(OASIS_DIR, "versions", "1.21", "mods");
    const jarPath = path.join(modsDir, MOD_JAR_NAME);
    if (enabled && !fs.existsSync(jarPath)) {
      fs.mkdirSync(modsDir, { recursive: true });
      log("Mod enabled but JAR not found. Place oasis-visuals.jar in " + modsDir, "WARN");
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================
// FILE MANAGEMENT (drag-and-drop)
// ============================================
function sanitizePathPart(input) {
  if (typeof input !== "string") return "";
  const safe = path.normalize(input).replace(/^[A-Za-z]:\\?/, "");
  if (safe.startsWith("..") || safe.startsWith("/") || safe.startsWith("\\")) return "";
  return safe.replace(/[/\\]/g, "");
}

function getCustomDir(mcVersion, category) {
  const safeVersion = sanitizePathPart(mcVersion);
  const safeCategory = sanitizePathPart(category);
  const base = path.join(OASIS_DIR, "versions", safeVersion);
  return path.join(base, safeCategory);
}

ipcMain.handle("drop-file", async (_event, { sourcePath, mcVersion, category }) => {
  try {
    const destDir = getCustomDir(mcVersion, category);
    fs.mkdirSync(destDir, { recursive: true });
    const resolvedSource = path.resolve(sourcePath);
    const destPath = path.join(destDir, path.basename(resolvedSource));
    let finalPath = destPath;
    let idx = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(destPath);
      const base = path.basename(destPath, ext);
      finalPath = path.join(destDir, `${base} (${idx})${ext}`);
      idx++;
    }
    fs.copyFileSync(resolvedSource, finalPath);
    return { success: true, fileName: path.basename(finalPath) };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("list-files", async (_event, { mcVersion, category }) => {
  try {
    const dir = getCustomDir(mcVersion, category);
    if (!fs.existsSync(dir)) return { success: true, data: [] };
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile())
      .map(e => {
        const fullPath = path.join(dir, e.name);
        const stat = fs.statSync(fullPath);
        return { name: e.name, size: stat.size, modified: stat.mtimeMs };
      })
      .sort((a, b) => b.modified - a.modified);
    return { success: true, data: files };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("delete-file", async (_event, { mcVersion, category, fileName }) => {
  try {
    const dir = getCustomDir(mcVersion, category);
    const safeName = path.basename(fileName);
    const filePath = path.join(dir, safeName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================
// INSTALLED REGISTRY IPC
// ============================================
ipcMain.handle("get-installed", async () => {
  try {
    return { success: true, data: readInstalled() };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle("installed-check", async (_event, { versionId, sha1 }) => {
  try {
    const entry = getInstalledVersion(versionId);
    if (!entry) return { success: false, installed: false };

    const metaPath = path.join(OASIS_DIR, "versions", versionId, "version.json");
    if (!fs.existsSync(metaPath)) return { success: true, installed: false, reason: "no_version_json" };

    const clientPath = path.join(OASIS_DIR, "versions", versionId, `${versionId}.jar`);
    if (!fs.existsSync(clientPath)) return { success: true, installed: false, reason: "no_client_jar" };

    if (sha1 && entry.sha1 !== sha1) return { success: true, installed: false, reason: "sha1_mismatch", expected: sha1, got: entry.sha1 };

    return { success: true, installed: true, entry };
  } catch (e) { return { success: false, error: e.message }; }
});

// ============================================
// MOJANG VERSION JSON FETCHER
// ============================================
async function fetchMojangVersionJson(versionId) {
  try {
    const res = await fetch(`${LOCAL_API}/api/versions/vanilla/${encodeURIComponent(versionId)}`);
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const json = await res.json();
    return json.data || json;
  } catch (e) {
    log(`fetchMojangVersionJson(${versionId}) via backend failed: ${e.message}`, "WARN");
    const manifestRes = await fetch(MANIFEST_URL);
    if (!manifestRes.ok) throw new Error(`Manifest fetch failed: ${manifestRes.status}`);
    const manifest = await manifestRes.json();
    const entry = manifest.versions.find(v => v.id === versionId);
    if (!entry) throw new Error(`Version ${versionId} not found in Mojang manifest`);
    const verRes = await fetch(entry.url);
    if (!verRes.ok) throw new Error(`Version details failed: ${verRes.status}`);
    return await verRes.json();
  }
}

// ============================================
// RULE CHECKER (Mojang OS rules)
// ============================================
function getCurrentOs() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "osx";
  return "linux";
}

function shouldAllowRule(rules) {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  let hasExplicitAllow = false;
  for (const rule of rules) {
    // If rule has features check and we don't support any of them, deny
    if (rule.features) {
      const supportedFeatures = {
        is_demo_user: false,
        has_custom_resolution: false,
        is_quick_play_singleplayer: false,
        is_quick_play_multiplayer: false,
        is_quick_play_realms: false,
      };
      let featureMatch = true;
      for (const [key, val] of Object.entries(rule.features)) {
        if (supportedFeatures[key] !== val) { featureMatch = false; break; }
      }
      if (!featureMatch) continue;
    }
    if (rule.action === "allow") {
      hasExplicitAllow = true;
      if (!rule.os) { allowed = true; }
      else if (rule.os.name === getCurrentOs()) { allowed = true; }
      else if (rule.os.name === undefined) { allowed = true; }
    } else if (rule.action === "disallow") {
      if (!rule.os) { allowed = false; }
      else if (rule.os.name === getCurrentOs()) { allowed = false; }
    }
  }
  return hasExplicitAllow ? allowed : true;
}

// ============================================
// INSTALL VERSION (Mojang spec)
// ============================================
ipcMain.handle("install-version", async (event, { versionId, category, mcVersion }) => {
  const installId = mcVersion || versionId;
  log(`install-version: ${installId} (${category})`);

  // For vanilla/offline, download directly from Mojang
  return installVanillaVersion(event, installId, category, versionId);
});

async function installVanillaVersion(event, dirName, category, regKey) {
  log(`[install] fetching Mojang version JSON for ${dirName}`);
  const versionJson = await fetchMojangVersionJson(dirName);
  const verDir = path.join(OASIS_DIR, "versions", dirName);
  fs.mkdirSync(verDir, { recursive: true });

  // Save version JSON
  fs.writeFileSync(path.join(verDir, "version.json"), JSON.stringify(versionJson, null, 2));

  // 1. Download client JAR
  const clientUrl = versionJson.downloads?.client?.url;
  const clientSha1 = versionJson.downloads?.client?.sha1;
  const clientSize = versionJson.downloads?.client?.size || 0;
  const clientPath = path.join(verDir, `${dirName}.jar`);

  if (clientUrl) {
    log(`[install] downloading client jar: ${clientUrl}`);
    await downloadWithProgress(event, regKey, 0, 1, clientUrl, clientPath, clientSize, clientSha1, "client.jar");
  }

  // 2. Download libraries
  const libraries = versionJson.libraries || [];
  const osName = getCurrentOs();
  const libFileEntries = [];

  for (const lib of libraries) {
    if (!shouldAllowRule(lib.rules)) continue;

    const artifact = lib.downloads?.artifact;
    if (artifact) {
      libFileEntries.push({
        path: `libraries/${artifact.path}`,
        url: LIBRARIES_BASE + artifact.path,
        size: artifact.size,
        sha1: artifact.sha1,
      });
    }

    // Native classifiers
    if (lib.downloads?.classifiers) {
      const nativeKey = `natives-${osName}`;
      const nativeKey64 = `natives-${osName}-64`;
      const nativeLib = lib.downloads.classifiers[nativeKey] || lib.downloads.classifiers[nativeKey64] || lib.downloads.classifiers[`${osName}-natives`];
      if (nativeLib) {
        libFileEntries.push({
          path: `libraries/${nativeLib.path}`,
          url: LIBRARIES_BASE + nativeLib.path,
          size: nativeLib.size,
          sha1: nativeLib.sha1,
          native: true,
        });
      }
    }
  }

  const libTotal = libFileEntries.length;
  let libDone = 0;

  for (const entry of libFileEntries) {
    const destPath = path.join(OASIS_DIR, entry.path);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    if (entry.sha1 && fs.existsSync(destPath) && sha1File(destPath) === entry.sha1) {
      libDone++;
      sendDownloadProgress(event, regKey, 1 + libDone, 1 + libTotal + 1, 0, 0, `lib ${libDone}/${libTotal}`);
      continue;
    }

    try {
      await downloadFile(entry.url, destPath);
      if (entry.sha1 && sha1File(destPath) !== entry.sha1) {
        throw new Error(`SHA-1 mismatch for ${entry.path}`);
      }

      // Extract natives from JAR
      if (entry.native) {
        const nativesDir = path.join(verDir, "natives");
        fs.mkdirSync(nativesDir, { recursive: true });
        extractNativesJar(destPath, nativesDir);
      }
    } catch (e) {
      log(`[install] library download failed: ${entry.path} - ${e.message}`, "WARN");
    }

    libDone++;
    sendDownloadProgress(event, regKey, 1 + libDone, 1 + libTotal + 1, 0, 0, `lib ${libDone}/${libTotal}`);
  }

  // 3. Register in installed.json BEFORE downloading assets,
  // so the version appears installed even if assets fail.
  setInstalledVersion(regKey, {
    id: regKey,
    type: category,
    installedAt: new Date().toISOString(),
    sha1: clientSha1,
    gameVersion: dirName,
  });

  // 4. Download assets (optional — game may run without them)
  try {
    await downloadAssets(event, regKey, versionJson);
  } catch (e) {
    log(`[install] asset download failed (non-fatal): ${e.message}`, "WARN");
  }

  log(`[install] vanilla complete: ${dirName} (key=${regKey})`);
  return { success: true };
}



async function downloadAssets(event, versionId, versionJson) {
  const assetIndex = versionJson.assetIndex;
  if (!assetIndex || !assetIndex.url) {
    log("[install] no asset index, skipping assets");
    return;
  }

  const indexesDir = path.join(OASIS_DIR, "assets", "indexes");
  const objectsDir = path.join(OASIS_DIR, "assets", "objects");
  fs.mkdirSync(indexesDir, { recursive: true });
  fs.mkdirSync(objectsDir, { recursive: true });

  // Use assetIndex.id as filename (e.g. "1.16") — Minecraft looks for
  // assets/indexes/{assetIndexId}.json, NOT the launcher's version id
  const indexId = assetIndex.id || versionId;
  const indexPath = path.join(indexesDir, `${indexId}.json`);

  if (!fs.existsSync(indexPath) || (assetIndex.sha1 && sha1File(indexPath) !== assetIndex.sha1)) {
    log(`[install] downloading asset index from ${assetIndex.url}`);
    await downloadFile(assetIndex.url, indexPath);
  }

  if (assetIndex.sha1 && sha1File(indexPath) !== assetIndex.sha1) {
    throw new Error(`Asset index SHA-1 mismatch for ${indexId}`);
  }

  const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const assetObjects = indexData.objects || {};
  const assetKeys = Object.keys(assetObjects);
  const assetTotal = assetKeys.length;
  log(`[install] checking ${assetTotal} assets`);

  let assetDone = 0;
  let missingCount = 0;
  for (const key of assetKeys) {
    const hash = assetObjects[key].hash;
    const size = assetObjects[key].size || 0;
    const subDir = hash.substring(0, 2);
    const assetDest = path.join(objectsDir, subDir, hash);
    if (!fs.existsSync(assetDest) || fs.statSync(assetDest).size !== size) missingCount++;
  }

  if (missingCount > 0) log(`[install] ${missingCount} assets missing, downloading...`);
  else { log("[install] all assets cached"); return; }

  let nextReport = 0;
  for (const key of assetKeys) {
    const hash = assetObjects[key].hash;
    const size = assetObjects[key].size || 0;
    const subDir = hash.substring(0, 2);
    const assetDest = path.join(objectsDir, subDir, hash);

    if (!fs.existsSync(assetDest) || fs.statSync(assetDest).size !== size) {
      fs.mkdirSync(path.dirname(assetDest), { recursive: true });
      try {
        await downloadFile(`${ASSETS_BASE}/${subDir}/${hash}`, assetDest);
      } catch (e) {
        log(`[install] asset download failed: ${key} - ${e.message}`, "WARN");
      }
    }

    assetDone++;
    if (assetDone - nextReport >= 100 || assetDone === assetTotal) {
      sendDownloadProgress(event, versionId, 0, 0, 0, 0, `assets ${assetDone}/${assetTotal}`);
      nextReport = assetDone;
    }
  }

  log(`[install] assets complete: ${assetDone}/${assetTotal}`);
}

// ============================================
// LAUNCH GAME (Mojang spec: arguments.jvm, arguments.game)
// ============================================
ipcMain.handle("launch-game", async (event, { versionId, mcVersion, category, nickname, accountType, accountId }) => {
  try {
    const gameVersion = mcVersion || versionId;
    const versionDir = path.join(OASIS_DIR, "versions", gameVersion);
    const metaPath = path.join(versionDir, "version.json");
    const nativeDir = path.join(versionDir, "natives");

    log(`launch: ${gameVersion} (${category})`);

    // 1. Read version JSON
    if (!fs.existsSync(metaPath)) throw new Error(`Версия ${gameVersion} не установлена.`);
    const raw = fs.readFileSync(metaPath, "utf-8");
    let versionJson;
    try { versionJson = JSON.parse(raw); } catch {
      throw new Error(`Повреждён манифест версии ${gameVersion}`);
    }

    // 2. Find Java
    const javaPath = findJava();
    if (!javaPath) throw new Error("Java не найдена. Установите Java 17+ с https://adoptium.net");
    log(`Java: ${javaPath}`);

    let javaVersion = 17;
    try {
      javaVersion = await getJavaMajorVersion(javaPath);
      log(`Java version: ${javaVersion}`);
      if (javaVersion < 17) log(`Java ${javaVersion} может быть слишком старой`, "WARN");
    } catch (e) { log(`Java version check failed, assuming 17+: ${e.message}`, "WARN"); }

    // 3. Build classpath from libraries section
    const classpathEntries = [];
    const clientJar = path.join(versionDir, `${gameVersion}.jar`);
    if (fs.existsSync(clientJar)) classpathEntries.push(clientJar);
    else log(`client jar not found: ${clientJar}`, "WARN");

    const osName = getCurrentOs();
    const libraries = versionJson.libraries || [];
    for (const lib of libraries) {
      if (!shouldAllowRule(lib.rules)) continue;
      if (lib.downloads?.artifact) {
        const libPath = path.join(OASIS_DIR, "libraries", lib.downloads.artifact.path);
        if (fs.existsSync(libPath)) classpathEntries.push(libPath);
      }
    }

    const classpath = classpathEntries.join(path.delimiter);
    log(`classpath: ${classpathEntries.length} entries`);

    // 4. Build native library path
    fs.mkdirSync(nativeDir, { recursive: true });
    // Extract natives from native library JARs
    for (const lib of libraries) {
      if (!shouldAllowRule(lib.rules)) continue;
      if (lib.downloads?.classifiers) {
        const nativeKey = `natives-${osName}`;
        const nativeKey64 = `natives-${osName}-64`;
        const nativeLib = lib.downloads.classifiers[nativeKey] || lib.downloads.classifiers[nativeKey64] || lib.downloads.classifiers[`${osName}-natives`];
        if (nativeLib) {
          const libPath = path.join(OASIS_DIR, "libraries", nativeLib.path);
          if (fs.existsSync(libPath)) extractNativesJar(libPath, nativeDir);
        }
      }
    }

    // 5. Account data (offline mode per Mojang spec)
    let username = nickname || "Player";
    let uuid;
    let accessToken = "0";

    if (accountType === "pirate" || accountType === "offline" || !accountType) {
      const md5Bytes = crypto.createHash("md5").update("OfflinePlayer:" + username).digest();
      md5Bytes[6] = (md5Bytes[6] & 0x0f) | 0x30;
      md5Bytes[8] = (md5Bytes[8] & 0x3f) | 0x80;
      const hex = md5Bytes.toString("hex");
      uuid = hex.substring(0, 8) + "-" + hex.substring(8, 12) + "-" + hex.substring(12, 16) + "-" + hex.substring(16, 20) + "-" + hex.substring(20, 32);
      accessToken = "0";
    } else {
      uuid = "00000000-0000-0000-0000-000000000000";
      accessToken = "msa-token-" + accountId;
    }

    // 6. Template variables
    const assetsDir = path.join(OASIS_DIR, "assets");
    const assetIndexId = versionJson.assetIndex?.id || gameVersion;
    const userType = (accountType === "pirate" || accountType === "offline") ? "legacy" : "msa";
    const isOffline = (accountType === "pirate" || accountType === "offline" || !accountType);

    const authSession = `token:${accessToken}:${uuid}`;

    const userPropsJson = isOffline ? "{\"msa\":[]}" : "{}";

    function tmpl(key) {
      const map = {
        "auth_player_name": username,
        "auth_uuid": uuid,
        "auth_access_token": accessToken,
        "auth_session": authSession,
        "auth_xuid": "",
        "auth_user_properties": userPropsJson,
        "version_name": gameVersion,
        "game_directory": versionDir,
        "game_assets": assetsDir,
        "assets_root": assetsDir,
        "assets_index_name": assetIndexId,
        "user_type": userType,
        "user_properties": userPropsJson,
        "natives_directory": nativeDir.replace(/\\/g, "/"),
        "classpath": classpath,
        "classpath_separator": path.delimiter,
        "launcher_name": "oasis",
        "launcher_version": "1.0.0",
        "library_directory": path.join(OASIS_DIR, "libraries").replace(/\\/g, "/"),
        "clientid": "oasis-launcher",
      };
      return map[key] !== undefined ? map[key] : "";
    }

    // 7. Parse JVM arguments
    let jvmArgs = [];
    if (versionJson.arguments?.jvm) {
      for (const arg of versionJson.arguments.jvm) {
        if (typeof arg === "string") {
          jvmArgs.push(replaceTmpl(arg, tmpl));
        } else if (typeof arg === "object" && arg.rules) {
          if (shouldAllowRule(arg.rules) && arg.value) {
            const values = Array.isArray(arg.value) ? arg.value : [arg.value];
            for (const v of values) jvmArgs.push(replaceTmpl(v, tmpl));
          }
        }
      }
    } else {
      jvmArgs = [
        `-Xms512m`, `-Xmx2g`,
        `-Djava.library.path=${nativeDir}`,
        `-cp`, classpath,
      ];
    }

    // Inject Java compatibility flags for modern JDKs
    if (javaVersion >= 22) {
      jvmArgs.unshift("--enable-native-access=ALL-UNNAMED");
      jvmArgs.unshift("--add-opens", "java.base/java.lang=ALL-UNNAMED");
      jvmArgs.unshift("--add-opens", "java.base/java.util=ALL-UNNAMED");
      jvmArgs.unshift("--add-opens", "java.base/java.lang.reflect=ALL-UNNAMED");
    } else if (javaVersion >= 17) {
      jvmArgs.unshift("--add-opens", "java.base/java.lang=ALL-UNNAMED");
      jvmArgs.unshift("--add-opens", "java.base/java.util=ALL-UNNAMED");
      jvmArgs.unshift("--add-opens", "java.base/java.lang.reflect=ALL-UNNAMED");
    }

    // 8. Parse game arguments
    let gameArgs = [];
    if (versionJson.arguments?.game) {
      for (const arg of versionJson.arguments.game) {
        if (typeof arg === "string") {
          gameArgs.push(replaceTmpl(arg, tmpl));
        } else if (typeof arg === "object" && arg.rules) {
          if (shouldAllowRule(arg.rules) && arg.value) {
            const values = Array.isArray(arg.value) ? arg.value : [arg.value];
            for (const v of values) gameArgs.push(replaceTmpl(v, tmpl));
          }
        }
      }
    } else if (versionJson.minecraftArguments) {
      gameArgs = versionJson.minecraftArguments.split(" ").map(a => replaceTmpl(a, tmpl));
    } else {
      gameArgs = [
        `--username`, username,
        `--uuid`, uuid,
        `--accessToken`, accessToken,
        `--version`, gameVersion,
        `--gameDir`, versionDir,
        `--assetsDir`, assetsDir,
        `--assetIndex`, assetIndexId,
        `--userProperties`, userPropsJson,
        `--userType`, userType,
        `--xuid`, "",
      ];
    }

    gameArgs = gameArgs.filter(arg => arg !== "--demo");

    const mainClass = versionJson.mainClass || "net.minecraft.client.main.Main";
    const fullArgs = [...jvmArgs, mainClass, ...gameArgs];
    log(`cmd: ${javaPath} ${fullArgs.slice(0, 8).join(" ")}...`);

    // 9. Spawn
    const result = await new Promise((resolve, reject) => {
      const gameProcess = spawn(javaPath, fullArgs, {
        cwd: versionDir, stdio: "inherit",
      });
      const timeout = setTimeout(() => {
        gameProcess.kill();
        reject(new Error("Java process timed out"));
      }, 120000);
      // Once game stays alive for 20s, remove timeout (it's clearly running)
      const readyTimer = setTimeout(() => clearTimeout(timeout), 20000);
      readyTimer.unref();
      gameProcess.on("error", (err) => {
        clearTimeout(timeout);
        clearTimeout(readyTimer);
        const msg = `Ошибка запуска Java: ${err.message}. Убедитесь, что Java 17+ установлена.`;
        log(msg, "ERROR");
        reject(new Error(msg));
      });
      gameProcess.on("close", (code) => {
        clearTimeout(timeout);
        clearTimeout(readyTimer);
        log(`game exited with code ${code}`);
        if (code !== 0 && code !== null) log(`Minecraft завершилась с кодом ${code}`, "WARN");
        if (code === 0) touchInstalledLaunched(gameVersion);
        resolve({ exitCode: code });
      });
    });
    return { success: true, ...result };
  } catch (e) {
    log(`launch-game failed: ${e.message}`, "ERROR");
    return { success: false, error: e.message };
  }
});

function replaceTmpl(val, tmplFn) {
  if (typeof val !== "string") return val;
  return val.replace(/\$\{([^}]+)\}/g, (_, key) => tmplFn(key));
}

// ============================================
// HELPERS
// ============================================
function sendDownloadProgress(event, versionId, filesDone, filesTotal, totalSize, downloadedBytes, fileName) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const percent = totalSize > 0 ? Math.min(100, Math.round((downloadedBytes / totalSize) * 100)) : 0;
  event.sender.send("download-progress", {
    versionId, percent, filesDone, filesTotal,
    fileName: fileName ? path.basename(fileName) : "",
  });
}

function extractNativesJar(jarPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  // Method 1: .NET ZipFile (most reliable, no execution policy issues)
  try {
    execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${jarPath.replace(/'/g, "''")}', '${destDir.replace(/'/g, "''")}', $true)"`,
      { stdio: "pipe", timeout: 30000 }
    );
    return;
  } catch (e) { log(`extract (.net zipfile) failed: ${e.message}`, "WARN"); }
  // Method 2: PowerShell Expand-Archive
  try {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${jarPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`, {
      stdio: "pipe", timeout: 15000,
    });
    return;
  } catch (e) { log(`extract (expand-archive) failed: ${e.message}`, "WARN"); }
  // Method 3: tar.exe (Win10+)
  try {
    execSync(`tar -xf "${jarPath}"`, { cwd: destDir, stdio: "pipe", timeout: 15000 });
    return;
  } catch (e) { log(`extract (tar.exe) failed: ${e.message}`, "WARN"); }
  // Method 4: jar.exe from JDK
  try {
    const jarExe = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "jar.exe") : "jar.exe";
    execSync(`"${jarExe}" xf "${jarPath}"`, { cwd: destDir, stdio: "pipe", timeout: 15000 });
  } catch (e) { log(`extract (jar.exe) failed: ${e.message}`, "WARN"); }
}

async function downloadWithProgress(event, versionId, baseDone, baseTotal, url, destPath, expectedSize, expectedSha1, label) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (expectedSha1 && fs.existsSync(destPath) && sha1File(destPath) === expectedSha1) {
    sendDownloadProgress(event, versionId, baseDone + 1, baseTotal + 1, expectedSize, expectedSize, label);
    return;
  }
  await downloadFile(url, destPath, (rcv) => {
    sendDownloadProgress(event, versionId, baseDone, baseTotal + 1, expectedSize, rcv, label);
  });
  if (expectedSha1 && sha1File(destPath) !== expectedSha1) {
    throw new Error(`SHA-1 mismatch for ${label}`);
  }
  sendDownloadProgress(event, versionId, baseDone + 1, baseTotal + 1, expectedSize, expectedSize, label);
}

function downloadFile(url, destPath, onProgress, depth = 0) {
  if (depth > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith("/api/") ? `${LOCAL_API}${url}` : url;
    const file = fs.createWriteStream(destPath);
    const parsedUrl = new URL(fullUrl);
    const httpMod = parsedUrl.protocol === "https:" ? https : http;

    const req = httpMod.get(fullUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath, onProgress, depth + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} downloading ${fullUrl}`));
        return;
      }
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let received = 0;
      res.on("data", (chunk) => {
        received += chunk.length;
        file.write(chunk);
        if (onProgress && total > 0) onProgress(received);
      });
      res.on("end", () => file.end());
      file.on("finish", () => resolve());
    });
    req.on("error", (err) => { file.close(); reject(err); });
  });
}

function sha1File(filePath) {
  const hash = crypto.createHash("sha1");
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(65536);
  let bytes;
  try {
    while ((bytes = fs.readSync(fd, buf, 0, 65536, null)) > 0) {
      hash.update(buf.subarray(0, bytes));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function calculateDirSize(filePaths) {
  let total = 0;
  for (const fp of filePaths) {
    try { total += fs.statSync(fp).size; } catch (e) { /* skip */ }
  }
  return total;
}

// ============================================
// JAVA FINDER
// ============================================
function findJava() {
  const candidates = [];
  if (process.env.JAVA_HOME) {
    const jHome = path.join(process.env.JAVA_HOME, "bin", "java.exe");
    if (fs.existsSync(jHome)) candidates.push(jHome);
    const jHome2 = path.join(process.env.JAVA_HOME, "bin", "java");
    if (fs.existsSync(jHome2)) candidates.push(jHome2);
  }
  candidates.push("java.exe");
  candidates.push("java");
  for (const pf of [process.env["ProgramFiles"], process.env["ProgramFiles(x86)"]]) {
    if (!pf) continue;
    for (const dir of ["jdk-21", "jdk-17", "jdk-11", "jdk-8"]) {
      const p = path.join(pf, "Java", dir, "bin", "java.exe");
      if (fs.existsSync(p)) candidates.push(p);
      const p2 = path.join(pf, "Eclipse Adoptium", dir, "bin", "java.exe");
      if (fs.existsSync(p2)) candidates.push(p2);
    }
  }
  const pathDirs = (process.env.PATH || "").split(";");
  for (const dir of pathDirs) {
    try {
      const p = path.join(dir, "java.exe");
      if (fs.existsSync(p)) candidates.push(p);
      const p2 = path.join(dir, "java");
      if (fs.existsSync(p2)) candidates.push(p2);
    } catch (e) { /* skip */ }
  }
  const seen = new Set();
  for (const c of candidates) {
    const normalized = path.resolve(c).toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    try { fs.accessSync(c, fs.constants.X_OK); return c; } catch (e) { /* try next */ }
  }
  return process.platform === "win32" ? "java.exe" : "java";
}

function getJavaMajorVersion(javaPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(javaPath, ["-version"]);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) => reject(err));
    proc.on("close", () => {
      const m = stderr.match(/(?:version|openjdk version|java version) ["']?(\d+)/);
      if (m) resolve(parseInt(m[1], 10));
      else reject(new Error("Cannot parse java version"));
    });
  });
}

// ============================================
// LOGGING
// ============================================
const LOG_PATH = path.join(OASIS_DIR, "launcher.log");

function log(msg, level = "INFO") {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, line + "\n");
  } catch (e) { /* silently fail */ }
}

// ============================================
// APP LIFECYCLE
// ============================================
app.whenReady().then(() => {
  // Создаём окно сразу, не ждём бэкенд
  createWindow();
  // Запускаем бэкенд параллельно (он встроен в процесс)
  startEmbeddedBackend();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopEmbeddedBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => { stopEmbeddedBackend(); });
