package com.oasis.visuals.mixins;

import net.minecraft.client.render.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(GameRenderer.class)
public class GameRendererMixin {
    private float storedGamma = -1;

    @ModifyVariable(method = "renderWorld", at = @At("HEAD"), argsOnly = true)
    private float modifyGamma(float gamma) {
        return gamma;
    }

    @ModifyVariable(method = "tick", at = @At("HEAD"))
    private float onTick(float delta) {
        return delta;
    }
}
