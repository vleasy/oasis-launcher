package com.oasis.visuals.modules;

import java.util.*;

public abstract class Module {
    private final String id;
    private final String name;
    private final Category category;
    private final String description;
    private boolean enabled = true;
    private final List<Setting> settings = new ArrayList<>();

    public Module(String id, String name, Category category, String description) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.description = description;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public Category getCategory() { return category; }
    public String getDescription() { return description; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean v) { this.enabled = v; onToggle(v); }
    public boolean hasSettings() { return !settings.isEmpty(); }
    public List<Setting> getSettings() { return settings; }

    protected void addSetting(String key, String name, String defaultValue, String... options) {
        settings.add(new Setting(key, name, defaultValue, options));
    }

    public void onToggle(boolean enabled) {}
    public void onTick() {}
    public void onRender() {}

    public enum Category {
        FRIENDS("Friends"), HUD("HUD"), COMBAT("Combat"),
        VISUALS("Visuals"), AUTOMATION("Automation"), SETTINGS("Settings");

        private final String display;
        Category(String display) { this.display = display; }
        public String getDisplay() { return display; }
    }

    public record Setting(String key, String name, String defaultValue, String[] options) {}
}
