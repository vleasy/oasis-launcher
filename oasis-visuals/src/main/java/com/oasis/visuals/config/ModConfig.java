package com.oasis.visuals.config;

import com.google.gson.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;

public class ModConfig {
    private static final Path CONFIG_PATH = Path.of(
        System.getProperty("user.home"),
        "AppData", "Roaming", ".minecraft", "config", "oasis-visuals.json"
    );
    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    private final Map<String, Boolean> enabledModules = new HashMap<>();
    private final Map<String, Map<String, Object>> moduleSettings = new HashMap<>();

    public void load() {
        enabledModules.clear();
        moduleSettings.clear();
        try {
            if (Files.exists(CONFIG_PATH)) {
                JsonObject root = gson.fromJson(Files.readString(CONFIG_PATH), JsonObject.class);
                if (root.has("enabled")) {
                    JsonObject en = root.getAsJsonObject("enabled");
                    en.entrySet().forEach(e -> enabledModules.put(e.getKey(), e.getValue().getAsBoolean()));
                }
                if (root.has("settings")) {
                    JsonObject st = root.getAsJsonObject("settings");
                    st.entrySet().forEach(e -> {
                        JsonObject o = e.getValue().getAsJsonObject();
                        Map<String, Object> map = new HashMap<>();
                        o.entrySet().forEach(se -> map.put(se.getKey(), se.getValue().getAsString()));
                        moduleSettings.put(e.getKey(), map);
                    });
                }
            }
        } catch (Exception e) {
            System.err.println("[OasisVisuals] Failed to load config: " + e.getMessage());
        }
    }

    public void save() {
        try {
            Files.createDirectories(CONFIG_PATH.getParent());
            JsonObject root = new JsonObject();
            JsonObject en = new JsonObject();
            enabledModules.forEach(en::addProperty);
            root.add("enabled", en);
            JsonObject st = new JsonObject();
            moduleSettings.forEach((mod, map) -> {
                JsonObject o = new JsonObject();
                map.forEach((k, v) -> o.addProperty(k, String.valueOf(v)));
                st.add(mod, o);
            });
            root.add("settings", st);
            Files.writeString(CONFIG_PATH, gson.toJson(root));
        } catch (Exception e) {
            System.err.println("[OasisVisuals] Failed to save config: " + e.getMessage());
        }
    }

    public boolean isEnabled(String moduleId) {
        return enabledModules.getOrDefault(moduleId, true);
    }

    public void setEnabled(String moduleId, boolean enabled) {
        enabledModules.put(moduleId, enabled);
        save();
    }

    public String getSetting(String moduleId, String key, String fallback) {
        var m = moduleSettings.get(moduleId);
        if (m != null && m.containsKey(key)) return (String) m.get(key);
        return fallback;
    }

    public void setSetting(String moduleId, String key, String value) {
        moduleSettings.computeIfAbsent(moduleId, k -> new HashMap<>()).put(key, value);
        save();
    }

    public void exportProfile(Path target) throws IOException {
        Files.writeString(target, gson.toJson(Files.readString(CONFIG_PATH)));
    }

    public void importProfile(Path source) throws IOException {
        Files.copy(source, CONFIG_PATH, StandardCopyOption.REPLACE_EXISTING);
        load();
    }

    public void resetAll() {
        enabledModules.clear();
        moduleSettings.clear();
        save();
    }
}
