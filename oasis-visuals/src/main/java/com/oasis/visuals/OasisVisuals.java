package com.oasis.visuals;

import com.oasis.visuals.config.ModConfig;
import com.oasis.visuals.modules.ModuleManager;
import com.oasis.visuals.api.LauncherIntegration;
import com.oasis.visuals.gui.OasisMenuScreen;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public class OasisVisuals implements ClientModInitializer {
    public static final String MOD_ID = "oasis-visuals";
    private static ModConfig config;
    private static ModuleManager moduleManager;
    private static LauncherIntegration launcherIntegration;
    private static KeyBinding menuKey;

    @Override
    public void onInitializeClient() {
        config = new ModConfig();
        config.load();

        moduleManager = new ModuleManager(config);
        moduleManager.loadEnabled();

        launcherIntegration = new LauncherIntegration();
        launcherIntegration.start();

        menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.oasis-visuals.menu",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_RIGHT_SHIFT,
            "category.oasis-visuals"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (menuKey.wasPressed()) {
                MinecraftClient.getInstance().setScreen(new OasisMenuScreen(null, config, moduleManager));
            }
        });
    }

    public static ModConfig getConfig() { return config; }
    public static ModuleManager getModuleManager() { return moduleManager; }
    public static LauncherIntegration getLauncherIntegration() { return launcherIntegration; }
}
