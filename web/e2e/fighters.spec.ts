// Customizing the fighters on their own screen.
import { expect, test } from "@playwright/test";
import { ARMBAR, open, savedSettings } from "./helpers.ts";

test("the fighters screen changes build and belt, then returns to the move", async ({ page }) => {
  await open(page, ARMBAR);
  await page.locator("#settings-btn").click();
  await page.getByRole("button", { name: /Lutadores/ }).click();
  const drawer = page.locator("#customizer");
  await expect(drawer).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/studio/);
  await expect(page.locator(".player")).toBeHidden();

  const slider = drawer.locator('input[type="range"]');
  await slider.fill("1.15");
  await drawer.getByRole("button", { name: "Preta" }).click();
  await expect(drawer.getByRole("button", { name: "Preta" })).toHaveAttribute("aria-pressed", "true");
  expect((await savedSettings(page)).fighters[0]).toEqual({ build: 1.15, belt: "black" });

  // The second fighter has its own style; reset brings back the default.
  await drawer.getByRole("tab", { name: /Azul/ }).click();
  await expect(drawer.getByRole("tab", { name: /Azul/ })).toHaveAttribute("aria-selected", "true");
  await drawer.getByRole("button", { name: "Roxa" }).click();
  await drawer.getByRole("button", { name: "Restaurar" }).click();
  await expect(drawer.getByRole("button", { name: "Branca" })).toHaveAttribute("aria-pressed", "true");

  await drawer.getByRole("button", { name: "Pronto" }).click();
  await expect(drawer).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/studio/);
  await expect(page.locator(".player")).toBeVisible();

  await page.reload();
  await expect(page.locator("#thumbs .thumb").first()).toBeVisible();
  expect((await savedSettings(page)).fighters[0]).toEqual({ build: 1.15, belt: "black" });
});
