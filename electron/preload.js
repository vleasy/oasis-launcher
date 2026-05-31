const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  getBackendUrl: () => `http://localhost:3000`,
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  closeWindow: () => ipcRenderer.send("window-close"),

  // Auth
  authRegister: (email, password) =>
    ipcRenderer.invoke("auth-register", { email, password }),
  authLogin: (email, password) =>
    ipcRenderer.invoke("auth-login", { email, password }),
  authLogout: () =>
    ipcRenderer.invoke("auth-logout"),
  checkAuth: () =>
    ipcRenderer.invoke("auth-check"),

  // Remember Me
  rememberMeGet: () =>
    ipcRenderer.invoke("remember-me-get"),
  rememberMeSet: (email, refreshToken, remember) =>
    ipcRenderer.invoke("remember-me-set", { email, refreshToken, remember }),
  rememberMeClear: () =>
    ipcRenderer.invoke("remember-me-clear"),

  // Install version
  installVersion: (versionId, category, mcVersion) =>
    ipcRenderer.invoke("install-version", { versionId, category, mcVersion }),

  // Launch game
  launchGame: (versionId, mcVersion, category, nickname, accountType, accountId) =>
    ipcRenderer.invoke("launch-game", { versionId, mcVersion, category, nickname, accountType, accountId }),

  // Installed versions
  getInstalled: () =>
    ipcRenderer.invoke("get-installed"),
  installedCheck: (versionId, sha1) =>
    ipcRenderer.invoke("installed-check", { versionId, sha1 }),

  // Language
  langGet: () =>
    ipcRenderer.invoke("lang-get"),
  langSet: (lang) =>
    ipcRenderer.invoke("lang-set", { lang }),

  // File management (drag-and-drop)
  dropFile: (sourcePath, mcVersion, category) =>
    ipcRenderer.invoke("drop-file", { sourcePath, mcVersion, category }),
  listFiles: (mcVersion, category) =>
    ipcRenderer.invoke("list-files", { mcVersion, category }),
  deleteFile: (mcVersion, category, fileName) =>
    ipcRenderer.invoke("delete-file", { mcVersion, category, fileName }),

  // Accounts
  getAccounts: () =>
    ipcRenderer.invoke("get-accounts"),
  addAccount: (nickname, type) =>
    ipcRenderer.invoke("add-account", { nickname, type }),
  removeAccount: (id) =>
    ipcRenderer.invoke("remove-account", { id }),
  setPrimaryAccount: (id) =>
    ipcRenderer.invoke("set-primary-account", { id }),

  // Profile
  getProfile: () =>
    ipcRenderer.invoke("get-profile"),
  updateProfile: (nickname, status, bio, favoriteVersionIds) =>
    ipcRenderer.invoke("update-profile", { nickname, status, bio, favoriteVersionIds }),
  uploadAvatar: (dataUrl) =>
    ipcRenderer.invoke("upload-avatar", { dataUrl }),
  saveProfileLocal: (data) =>
    ipcRenderer.invoke("save-profile-local", data),
  loadProfileLocal: () =>
    ipcRenderer.invoke("load-profile-local"),

  // Friends
  searchFriends: (query) =>
    ipcRenderer.invoke("search-friends", { query }),
  sendFriendRequest: (nickname) =>
    ipcRenderer.invoke("send-friend-request", { nickname }),
  getFriends: () =>
    ipcRenderer.invoke("get-friends"),
  getFriendRequests: () =>
    ipcRenderer.invoke("get-friend-requests"),
  acceptFriendRequest: (id) =>
    ipcRenderer.invoke("accept-friend-request", { id }),
  declineFriendRequest: (id) =>
    ipcRenderer.invoke("decline-friend-request", { id }),
  removeFriend: (id) =>
    ipcRenderer.invoke("remove-friend", { id }),
  blockFriend: (id) =>
    ipcRenderer.invoke("block-friend", { id }),
  getChatMessages: (friendId) =>
    ipcRenderer.invoke("get-chat-messages", { friendId }),
  sendChatMessage: (friendId, content) =>
    ipcRenderer.invoke("friends-chat-send", { friendId, content }),
  getUnreadCount: () =>
    ipcRenderer.invoke("get-unread-count"),

  // Builds
  shareBuild: (mcVersion, versionName, category) =>
    ipcRenderer.invoke("share-build", { mcVersion, versionName, category }),
  installSharedBuild: (code) =>
    ipcRenderer.invoke("install-shared-build", { code }),

  // Oasis Visuals Mod
  getModStatus: () => ipcRenderer.invoke("get-mod-status"),
  setModStatus: (enabled) => ipcRenderer.invoke("set-mod-status", { enabled }),

  // Listen for download progress
  onDownloadProgress: (callback) =>
    ipcRenderer.on("download-progress", (_event, data) => callback(data)),
});
