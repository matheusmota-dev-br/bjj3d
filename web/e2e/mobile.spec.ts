// A phone: everything fits, the title sits under the buttons.
import { expect, test } from "@playwright/test";
import { ARMBAR, open } from "./helpers.ts";

test.use({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true });

test("on a phone the screen fits and the title sits under the buttons", async ({ page }) => {
  await open(page, ARMBAR);
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(widths[0]).toBeLessThanOrEqual(widths[1]);
  const menu = (await page.locator("#menu").boundingBox())!;
  const card = (await page.locator("#title-card").boundingBox())!;
  expect(card.y).toBeGreaterThanOrEqual(menu.y + menu.height);
  expect(card.x + card.width).toBeLessThanOrEqual(390);
  await expect(page.locator("#camchip")).toBeHidden();
  const strip = (await page.locator(".strip").boundingBox())!;
  expect(strip.x).toBeGreaterThanOrEqual(0);
  expect(strip.x + strip.width).toBeLessThanOrEqual(390);

  // Tapping a thumbnail works by touch too.
  await page.locator("#thumbs .thumb").nth(1).tap();
  await expect(page.locator("#thumbs .thumb").nth(1)).toHaveClass(/now/);
  // The settings popover fits on screen.
  await page.locator("#settings-btn").tap();
  const pop = (await page.locator("#settings").boundingBox())!;
  expect(pop.x).toBeGreaterThanOrEqual(0);
  expect(pop.x + pop.width).toBeLessThanOrEqual(390);
});
