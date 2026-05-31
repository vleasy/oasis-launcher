package com.oasis.visuals.modules.automation;

import com.oasis.visuals.modules.Module;

public class AutomationModules {
    public static class AutoSprintModule extends Module {
        public AutoSprintModule() { super("auto-sprint", "Auto Sprint", Category.AUTOMATION, "Automatically sprint"); addSetting("mode", "Mode", "always", "always", "legit"); }
    }
    public static class AutoSneakModule extends Module {
        public AutoSneakModule() { super("auto-sneak", "Auto Sneak", Category.AUTOMATION, "Toggle sneak"); }
    }
    public static class AutoToolModule extends Module {
        public AutoToolModule() { super("auto-tool", "Auto Tool", Category.AUTOMATION, "Auto-select best tool"); }
    }
    public static class AutoSwimModule extends Module {
        public AutoSwimModule() { super("auto-swim", "Auto Swim", Category.AUTOMATION, "Auto-jump while swimming"); }
    }
    public static class AutoWalkModule extends Module {
        public AutoWalkModule() { super("auto-walk", "Auto Walk", Category.AUTOMATION, "Toggle auto-walk"); }
    }
    public static class AutoEatModule extends Module {
        public AutoEatModule() { super("auto-eat", "Auto Eat", Category.AUTOMATION, "Auto-eat when hungry"); addSetting("hunger", "Min Hunger", "6"); }
    }
    public static class AutoFishModule extends Module {
        public AutoFishModule() { super("auto-fish", "Auto Fish", Category.AUTOMATION, "Automatic fishing"); }
    }
    public static class AutoLootModule extends Module {
        public AutoLootModule() { super("auto-loot", "Auto Loot", Category.AUTOMATION, "Auto-pickup items"); }
    }
}
