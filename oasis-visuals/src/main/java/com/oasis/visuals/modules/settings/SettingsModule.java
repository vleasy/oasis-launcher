package com.oasis.visuals.modules.settings;

import com.oasis.visuals.modules.Module;

public class SettingsModule extends Module {
    public SettingsModule() {
        super("mod-settings", "Mod Settings", Category.SETTINGS, "Oasis Visuals configuration");
        addSetting("theme", "Theme", "dark", "dark", "light", "system");
        addSetting("language", "Language", "en", "en", "ru");
        addSetting("hud-scale", "HUD Scale", "100", "75", "100", "125", "150");
        addSetting("animations", "Animations", "on", "on", "off");
        addSetting("blur-intensity", "Blur Intensity", "medium", "low", "medium", "high");
    }
}
