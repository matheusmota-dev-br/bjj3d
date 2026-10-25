// Finding moves: the panel, search, tabs and positions.
import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

test("the panel opens over the view, searches, opens a result and closes", async ({ page }) => {
  await open(page);
  const body = page.locator("body");
  await expect(body).not.toHaveClass(/open/);
  await page.getByRole("button", { name: "☰ Navegar" }).click();
  await expect(body).toHaveClass(/open/);
  await expect(page.locator("#panel .now h2")).toHaveText(await page.locator("#title").textContent() as string);

  await page.locator("#search").fill("armbar");
  const results = page.locator("#panel-body .rows a");
  await expect(results.first()).toBeVisible();
  expect(await results.count()).toBeGreaterThan(3);
  const name = (await results.nth(1).locator(".main").textContent())!.trim();
  await results.nth(1).click();
  await expect(body).not.toHaveClass(/open/);
  await expect(page.locator("#title")).toHaveText(name);

  // A search with nothing found says so.
  await page.locator("#menu").click();
  await page.locator("#search").fill("zzzz-nothing");
  await expect(page.locator("#panel-body .empty")).toBeVisible();
  await page.locator("#search").fill("");

  // Tabs: finishes and positions.
  await page.getByRole("tab", { name: "Finalizações" }).click();
  await expect(page.getByRole("tab", { name: "Finalizações" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#panel-body .rows a .kind").first()).toBeVisible();
  await page.getByRole("tab", { name: "Posições" }).click();
  const positions = page.locator("#panel-body .tab-hint + ul.rows a");
  expect(await positions.count()).toBeGreaterThan(500);
  // Pictures render lazily as rows come into view.
  await expect(positions.first().locator("img")).toHaveAttribute("src", /^data:image\/jpeg/);
  await positions.first().click();
  await expect(page).toHaveURL(/#p\/\d+/);
  await expect(page.locator("#ends")).not.toBeEmpty();

  await page.locator("#menu").click();
  await page.locator("#panel-close").click();
  await expect(body).not.toHaveClass(/open/);
});
