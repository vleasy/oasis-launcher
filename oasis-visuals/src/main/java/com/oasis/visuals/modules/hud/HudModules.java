package com.oasis.visuals.modules.hud;

import com.oasis.visuals.modules.Module;

public class HudModules {
    public static class CoordsModule extends Module {
        public CoordsModule() {
            super("coords", "Coordinates", Category.HUD, "Display XYZ coordinates");
            addSetting("format", "Format", "XYZ: %x %y %z");
        }
    }
    public static class FPSModule extends Module {
        public FPSModule() {
            super("fps", "FPS Counter", Category.HUD, "Display current FPS");
        }
    }
    public static class KeystrokesModule extends Module {
        public KeystrokesModule() {
            super("keystrokes", "Keystrokes", Category.HUD, "Show pressed keys on screen");
        }
    }
    public static class PotionsModule extends Module {
        public PotionsModule() {
            super("potions", "Potion Effects", Category.HUD, "Display active potion effects");
        }
    }
    public static class ArmorHUDModule extends Module {
        public ArmorHUDModule() {
            super("armor-hud", "Armor HUD", Category.HUD, "Display armor status and durability");
        }
    }
    public static class CompassModule extends Module {
        public CompassModule() {
            super("compass", "Compass", Category.HUD, "Show direction indicator");
        }
    }
    public static class SpeedModule extends Module {
        public SpeedModule() {
            super("speed", "Speedometer", Category.HUD, "Display current movement speed");
            addSetting("unit", "Unit", "km/h", "km/h", "m/s", "blocks/s");
        }
    }
}
