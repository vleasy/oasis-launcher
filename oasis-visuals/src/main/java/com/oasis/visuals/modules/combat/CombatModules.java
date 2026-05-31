package com.oasis.visuals.modules.combat;

import com.oasis.visuals.modules.Module;

public class CombatModules {
    public static class ReachDisplayModule extends Module {
        public ReachDisplayModule() {
            super("reach-display", "Reach Display", Category.COMBAT, "Show attack reach distance");
        }
    }
    public static class AttackCooldownModule extends Module {
        public AttackCooldownModule() {
            super("attack-cooldown", "Attack Cooldown", Category.COMBAT, "Visual attack cooldown indicator");
        }
    }
    public static class TargetHUDModule extends Module {
        public TargetHUDModule() {
            super("target-hud", "Target HUD", Category.COMBAT, "Display targeted entity info");
            addSetting("style", "Style", "compact", "compact", "full");
        }
    }
    public static class CriticalsModule extends Module {
        public CriticalsModule() {
            super("criticals", "Criticals", Category.COMBAT, "Always deal critical hits");
        }
    }
    public static class AutoClickerModule extends Module {
        public AutoClickerModule() {
            super("auto-clicker", "Auto Clicker", Category.COMBAT, "Automatic clicking");
            addSetting("cps", "CPS", "12", "6", "8", "10", "12", "15", "20");
        }
    }
}
