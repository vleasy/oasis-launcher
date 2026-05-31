package com.oasis.visuals.modules;

import com.oasis.visuals.config.ModConfig;
import com.oasis.visuals.modules.friends.FriendsModules;
import com.oasis.visuals.modules.hud.HudModules;
import com.oasis.visuals.modules.combat.CombatModules;
import com.oasis.visuals.modules.visuals.VisualsModules;
import com.oasis.visuals.modules.automation.AutomationModules;
import com.oasis.visuals.modules.settings.SettingsModule;
import java.util.*;
import java.util.stream.Collectors;

public class ModuleManager {
    private final List<Module> modules = new ArrayList<>();
    private final ModConfig config;

    public ModuleManager(ModConfig config) {
        this.config = config;
        register(new FriendsModules.FriendsListModule());
        register(new FriendsModules.OnlineStatusModule());
        register(new FriendsModules.FriendMessagesModule());
        register(new FriendsModules.PartyModule());
        register(new HudModules.CoordsModule());
        register(new HudModules.FPSModule());
        register(new HudModules.KeystrokesModule());
        register(new HudModules.PotionsModule());
        register(new HudModules.ArmorHUDModule());
        register(new HudModules.CompassModule());
        register(new HudModules.SpeedModule());
        register(new CombatModules.ReachDisplayModule());
        register(new CombatModules.AttackCooldownModule());
        register(new CombatModules.TargetHUDModule());
        register(new CombatModules.CriticalsModule());
        register(new CombatModules.AutoClickerModule());
        register(new VisualsModules.FullbrightModule());
        register(new VisualsModules.NickHiderModule());
        register(new VisualsModules.EnchantGlintModule());
        register(new VisualsModules.NoFireOverlayModule());
        register(new VisualsModules.NoHurtCamModule());
        register(new VisualsModules.CustomCrosshairModule());
        register(new VisualsModules.ItemPhysicsModule());
        register(new VisualsModules.DropShadowModule());
        register(new VisualsModules.MotionBlurModule());
        register(new VisualsModules.TimeChangerModule());
        register(new VisualsModules.SkyColorModule());
        register(new VisualsModules.WaypointsModule());
        register(new VisualsModules.WorldTimeModule());
        register(new AutomationModules.AutoSprintModule());
        register(new AutomationModules.AutoSneakModule());
        register(new AutomationModules.AutoToolModule());
        register(new AutomationModules.AutoSwimModule());
        register(new AutomationModules.AutoWalkModule());
        register(new AutomationModules.AutoEatModule());
        register(new AutomationModules.AutoFishModule());
        register(new AutomationModules.AutoLootModule());
        register(new SettingsModule());
    }

    private void register(Module m) { modules.add(m); }

    public void loadEnabled() {
        for (Module m : modules) {
            m.setEnabled(config.isEnabled(m.getId()));
        }
    }

    public List<Module> getByCategory(String category) {
        return modules.stream()
            .filter(m -> m.getCategory().getDisplay().equals(category))
            .collect(Collectors.toList());
    }

    public Module get(String id) {
        return modules.stream().filter(m -> m.getId().equals(id)).findFirst().orElse(null);
    }

    public List<Module> getAll() { return modules; }
}
