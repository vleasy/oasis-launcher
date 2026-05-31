package com.oasis.visuals.gui;

import com.oasis.visuals.config.ModConfig;
import com.oasis.visuals.modules.Module;
import com.oasis.visuals.modules.ModuleManager;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import java.util.*;

public class OasisMenuScreen extends Screen {
    private final Screen parent;
    private final ModConfig config;
    private final ModuleManager moduleManager;
    private String selectedCategory;
    private int scrollOffset;
    private static final int SIDEBAR_W = 120;
    private static final int BG_COLOR = 0xCC0F172A;
    private static final int ACCENT = 0xFF38BDF8;

    public OasisMenuScreen(Screen parent, ModConfig config, ModuleManager moduleManager) {
        super(Text.literal("Oasis Visuals"));
        this.parent = parent;
        this.config = config;
        this.moduleManager = moduleManager;
        this.selectedCategory = "Friends";
    }

    @Override
    protected void init() {
        int cx = width / 2;
        int cy = height / 2;
        int panelX = cx - 250;
        int panelY = cy - 180;
        int panelW = 500;
        int panelH = 360;
        int sidebarEnd = panelX + SIDEBAR_W;

        addDrawableChild(ButtonWidget.builder(
            Text.literal("X").formatted(Formatting.RED),
            btn -> close()
        ).dimensions(panelX + panelW - 24, panelY + 4, 20, 20).build());

        // close on Escape handled by Screen superclass
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        renderBackground(ctx);
        int cx = width / 2;
        int cy = height / 2;
        int panelX = cx - 250;
        int panelY = cy - 180;
        int panelW = 500;
        int panelH = 360;

        // Main panel
        ctx.fill(panelX, panelY, panelX + panelW, panelY + panelH, BG_COLOR);
        drawBorder(ctx, panelX, panelY, panelW, panelH);

        // Sidebar
        int sidebarEnd = panelX + SIDEBAR_W;
        ctx.fill(panelX, panelY, sidebarEnd, panelY + panelH, 0xCC131F2F);

        // Category buttons
        List<String> categories = List.of("Friends", "HUD", "Combat", "Visuals", "Automation", "Settings");
        int catY = panelY + 30;
        for (String cat : categories) {
            int catColor = cat.equals(selectedCategory) ? ACCENT : 0xFF94A3B8;
            ctx.drawText(textRenderer, cat, panelX + 12, catY, catColor, false);
            if (cat.equals(selectedCategory))
                ctx.fill(panelX, catY - 2, panelX + 3, catY + 10, ACCENT);
            catY += 22;
        }

        // Title
        ctx.drawText(textRenderer, selectedCategory, sidebarEnd + 16, panelY + 10, ACCENT, false);

        // Module toggles
        List<Module> modules = moduleManager.getByCategory(selectedCategory);
        int mx = sidebarEnd + 16;
        int my = panelY + 30 - scrollOffset;
        for (Module mod : modules) {
            if (my + 14 < panelY || my > panelY + panelH - 10) { my += 28; continue; }
            String label = mod.isEnabled() ? "[ON] " : "[OFF] ";
            ctx.drawText(textRenderer, label + mod.getName(), mx, my, mod.isEnabled() ? 0xFFE2E8F0 : 0xFF64748B, false);
            if (mod.hasSettings()) {
                ctx.drawText(textRenderer, ">", mx + 130, my, 0xFF94A3B8, false);
            }
            my += 28;
        }

        super.render(ctx, mouseX, mouseY, delta);
    }

    @Override
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        int cx = width / 2;
        int cy = height / 2;
        int panelX = cx - 250;
        int panelY = cy - 180;
        int sidebarEnd = panelX + SIDEBAR_W;

        // Category selection
        List<String> categories = List.of("Friends", "HUD", "Combat", "Visuals", "Automation", "Settings");
        int catY = panelY + 30;
        for (String cat : categories) {
            if (mouseX >= panelX + 8 && mouseX <= sidebarEnd && mouseY >= catY - 2 && mouseY <= catY + 12) {
                selectedCategory = cat;
                scrollOffset = 0;
                return true;
            }
            catY += 22;
        }

        // Module toggle click
        List<Module> modules = moduleManager.getByCategory(selectedCategory);
        int mx = sidebarEnd + 16;
        int my = panelY + 30 - scrollOffset;
        for (Module mod : modules) {
            if (mouseX >= mx && mouseX <= mx + 160 && mouseY >= my && mouseY <= my + 14) {
                boolean newState = !mod.isEnabled();
                mod.setEnabled(newState);
                config.setEnabled(mod.getId(), newState);
                return true;
            }
            my += 28;
        }

        return super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
        scrollOffset = Math.max(0, scrollOffset - (int)(verticalAmount * 20));
        return true;
    }

    @Override
    public void close() {
        client.setScreen(parent);
    }

    private void drawBorder(DrawContext ctx, int x, int y, int w, int h) {
        ctx.fill(x, y, x + w, y + 1, ACCENT);
        ctx.fill(x, y + h - 1, x + w, y + h, ACCENT);
    }
}
