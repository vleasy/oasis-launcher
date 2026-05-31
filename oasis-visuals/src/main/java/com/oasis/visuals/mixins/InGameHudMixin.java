package com.oasis.visuals.mixins;

import com.oasis.visuals.OasisVisuals;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.gui.DrawContext;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InGameHud.class)
public class InGameHudMixin {
    @Inject(method = "render", at = @At("RETURN"))
    private void onRender(DrawContext ctx, float tickDelta, CallbackInfo ci) {
        var modules = OasisVisuals.getModuleManager().getAll();
        int y = 4;
        for (var m : modules) {
            if (m.isEnabled()) m.onRender();
        }
    }
}
