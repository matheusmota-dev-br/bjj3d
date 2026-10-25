// Settings: look, place, cameras, speed, options, theme, language, persisted across reloads.
import { expect, test } from "@playwright/test";
import { ARMBAR, open, savedSettings, viewerState } from "./helpers.ts";

test("settings change the view and survive a reload", async ({ page }) => {
  await open(page, ARMBAR, { query: "debug=1" });
  const popover = page.locator("#settings");
  await expect(popover).toBeHidden();
  await page.locator("#settings-btn").click();
  await expect(popover).toBeVisible();

  await popover.locator('#look [data-value="wood"]').click();
  await popover.locator('#place [data-value="night"]').click();
  await popover.locator('#camera [data-value="side"]').click();
  await popover.locator('#speed [data-value="0.5"]').click();
  await popover.getByText("Repetir").click();
  for (const sel of ['#look [data-value="wood"]', '#place [data-value="night"]', '#camera [data-value="side"]', '#speed [data-value="0.5"]'])
    await expect(popover.locator(sel)).toHaveAttribute("aria-pressed", "true");
  expect((await viewerState(page)).cameraMode).toBe("side");
  expect(await savedSettings(page)).toMatchObject({ look: "wood", place: "night", camera: "side", speed: 0.5, loop: true });

  // A click elsewhere closes the popover.
  await page.locator("#title").click();
  await expect(popover).toBeHidden();

  await page.reload();
  await expect(page.locator("#thumbs .thumb").first()).toBeVisible();
  await page.locator("#settings-btn").click();
  for (const sel of ['#look [data-value="wood"]', '#place [data-value="night"]', '#camera [data-value="side"]', '#speed [data-value="0.5"]'])
    await expect(popover.locator(sel)).toHaveAttribute("aria-pressed", "true");
  await expect(popover.locator(".option", { hasText: "Repetir" }).locator("input")).toBeChecked();
  expect((await viewerState(page)).cameraMode).toBe("side");
});

test("the camera chip switches between directed and free, and grabbing the view frees it", async ({ page }) => {
  await open(page, ARMBAR, { query: "debug=1" });
  const chip = page.locator("#camchip");
  await expect(chip.getByRole("button", { name: "Dirigida" })).toHaveAttribute("aria-pressed", "true");
  expect((await viewerState(page)).cameraMode).toBe("directed");

  const box = (await page.locator("#view").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(chip.getByRole("button", { name: "Livre" })).toHaveAttribute("aria-pressed", "true");
  expect((await viewerState(page)).cameraMode).toBe("free");

  await chip.getByRole("button", { name: "Dirigida" }).click();
  await expect(chip.getByRole("button", { name: "Dirigida" })).toHaveAttribute("aria-pressed", "true");
  expect((await viewerState(page)).cameraMode).toBe("directed");
});

test("the theme toggles and the language reloads the page in English", async ({ page }) => {
  await open(page, ARMBAR);
  const html = page.locator("html");
  const theme = await html.getAttribute("data-theme");
  await page.locator("#menu").click();
  await page.locator("#theme").click();
  await expect(html).toHaveAttribute("data-theme", theme === "dark" ? "light" : "dark");

  await page.locator("#lang").selectOption("en");
  await expect(html).toHaveAttribute("lang", "en");
  await expect(page.locator("#menu")).toHaveText("☰ Browse");
  await expect(page.locator("#search")).toHaveAttribute("placeholder", "Search: mount, armbar, guard…");
  await expect(page.locator("#title")).toHaveText(/armbar/i);
  await page.locator("#settings-btn").click();
  await expect(page.locator('#look [data-value="wood"]')).toHaveText("Wood");
  // The theme chosen before the reload is kept.
  await expect(html).toHaveAttribute("data-theme", theme === "dark" ? "light" : "dark");
});

test("Arabic turns the page right to left", async ({ page }) => {
  await open(page, ARMBAR);
  await page.locator("#menu").click();
  await page.locator("#lang").selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("#thumbs .thumb").first()).toBeVisible();
});
