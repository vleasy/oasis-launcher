package com.oasis.visuals.modules.visuals;

import com.oasis.visuals.modules.Module;

public class VisualsModules {
    public static class FullbrightModule extends Module {
        public FullbrightModule() { super("fullbright", "Fullbright", Category.VISUALS, "Full brightness in dark areas"); }
    }
    public static class NickHiderModule extends Module {
        public NickHiderModule() { super("nick-hider", "Nick Hider", Category.VISUALS, "Hide your nickname"); }
    }
    public static class EnchantGlintModule extends Module {
        public EnchantGlintModule() { super("enchant-glint", "Enchant Glint", Category.VISUALS, "Custom enchantment glint color"); addSetting("color", "Color", "#FF5555", "#FF5555", "#55FF55", "#5555FF", "#FFFF55", "#FF55FF", "#55FFFF"); }
    }
    public static class NoFireOverlayModule extends Module {
        public NoFireOverlayModule() { super("no-fire", "No Fire Overlay", Category.VISUALS, "Remove fire screen overlay"); }
    }
    public static class NoHurtCamModule extends Module {
        public NoHurtCamModule() { super("no-hurt-cam", "No Hurt Cam", Category.VISUALS, "Remove hurt camera tilt"); }
    }
    public static class CustomCrosshairModule extends Module {
        public CustomCrosshairModule() { super("custom-crosshair", "Custom Crosshair", Category.VISUALS, "Customizable crosshair"); addSetting("style", "Style", "dot", "cross", "dot", "circle", "plus"); addSetting("color", "Color", "#FFFFFF", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF"); }
    }
    public static class ItemPhysicsModule extends Module {
        public ItemPhysicsModule() { super("item-physics", "Item Physics", Category.VISUALS, "Realistic item drop physics"); }
    }
    public static class DropShadowModule extends Module {
        public DropShadowModule() { super("drop-shadow", "Drop Shadow", Category.VISUALS, "Shadow under dropped items"); }
    }
    public static class MotionBlurModule extends Module {
        public MotionBlurModule() { super("motion-blur", "Motion Blur", Category.VISUALS, "Motion blur effect"); addSetting("intensity", "Intensity", "medium", "low", "medium", "high"); }
    }
    public static class TimeChangerModule extends Module {
        public TimeChangerModule() { super("time-changer", "Time Changer", Category.VISUALS, "Override world time"); addSetting("time", "Time", "day", "day", "night", "sunset", "real"); }
    }
    public static class SkyColorModule extends Module {
        public SkyColorModule() { super("sky-color", "Sky Color", Category.VISUALS, "Custom sky color"); addSetting("color", "Color", "#87CEEB"); }
    }
    public static class WaypointsModule extends Module {
        public WaypointsModule() { super("waypoints", "Waypoints", Category.VISUALS, "Waypoint system"); addSetting("max-dist", "Max Distance", "500"); }
    }
    public static class WorldTimeModule extends Module {
        public WorldTimeModule() { super("world-time", "World Time", Category.VISUALS, "Display world time on HUD"); }
    }
}
