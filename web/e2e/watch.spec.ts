// Watching a move: the first visit, Oss!, the filmstrip, the keyboard, the finishing moment
// and chaining into the next move.
import { expect, test } from "@playwright/test";
import { ARMBAR, open, viewerState } from "./helpers.ts";

test("a first visit shows how to use it, then greets with Oss! and starts playing", async ({ page }) => {
  await open(page, ARMBAR, { firstVisit: true });
  const help = page.locator("#help");
  await expect(help).toBeVisible();
  await expect(help.locator("h2")).toHaveText("Como usar");

  await page.getByRole("button", { name: "Entendi" }).click();
  await expect(help).toBeHidden();
  await expect(page.locator("#oss")).toBeVisible();
  await expect(page.locator("#oss .word")).toHaveText("Oss!");
  await expect(page.locator("#oss")).toBeHidden();
  await expect(page.locator("#play")).toHaveText("❚❚");

  // The help is not shown again.
  await page.reload();
  await expect(page.locator("#thumbs .thumb").first()).toBeVisible();
  await expect(help).toBeHidden();
  await expect(page.locator("#title")).toHaveText("Chave de braço do joelho na barriga");
});

test("the filmstrip seeks, marks the current step and scrubs; the keyboard plays and steps", async ({ page }) => {
  await open(page, ARMBAR, { query: "debug=1&frame=0" });
  const thumbs = page.locator("#thumbs .thumb");
  await expect(thumbs).toHaveCount(4);
  await expect(thumbs.nth(0)).toHaveClass(/now/);

  await thumbs.nth(2).click();
  await expect(thumbs.nth(2)).toHaveClass(/now/);
  await expect(thumbs.nth(0)).not.toHaveClass(/now/);
  await expect(page.locator("#caption")).toHaveText(/^3\. /);
  const at3 = (await viewerState(page)).time;
  expect((await viewerState(page)).playing).toBe(false);

  // Dragging across the strip moves time with the pointer.
  const a = (await thumbs.nth(0).boundingBox())!, b = (await thumbs.nth(3).boundingBox())!;
  await page.mouse.move(a.x + 5, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 4 });
  const early = (await viewerState(page)).time;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  const late = (await viewerState(page)).time;
  await page.mouse.up();
  expect(early).toBeLessThan(at3);
  expect(late).toBeGreaterThan(at3);
  await expect(thumbs.nth(3)).toHaveClass(/now/);

  // Arrows step between the stops; space plays and pauses.
  await page.keyboard.press("ArrowLeft");
  await expect(thumbs.nth(3)).not.toHaveClass(/now/);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(thumbs.nth(0)).toHaveClass(/now/);
  await page.keyboard.press("ArrowRight");
  await expect(thumbs.nth(1)).toHaveClass(/now/);
  await page.keyboard.press(" ");
  await expect(page.locator("#play")).toHaveText("❚❚");
  await expect.poll(async () => (await viewerState(page)).time).toBeGreaterThan(at3);
  await page.keyboard.press(" ");
  await expect(page.locator("#play")).toHaveText("▶");
});

test("in the danger range the risk notice and the ring show, and the finishing moment plays", async ({ page }) => {
  // Paused inside the lock: the notice and the ring, the angle only when asked for.
  await open(page, ARMBAR, { query: "frame=8" });
  await expect(page.locator("#risk")).toHaveClass(/on/);
  await expect(page.locator("#risk")).toContainText("cotovelo");
  await expect(page.locator("#attention")).toHaveClass(/on/);
  await expect(page.locator("#angle")).not.toHaveClass(/on/);

  // Playing into it: time slows, the edges darken, the ring burns and a pulse leaves it.
  await page.goto("/?graph=e2e/graph.json&frame=5#" + ARMBAR);
  await expect(page.locator("#risk")).not.toHaveClass(/on/);
  await page.locator("#play").click();
  await expect.poll(async () => Number(await page.locator("#stage").evaluate((s) => getComputedStyle(s).getPropertyValue("--impact") || "0")), { intervals: [50] }).toBeGreaterThan(0.5);
  await expect(page.locator("#attention")).toHaveClass(/hot/);
  await expect(page.locator("#risk")).toHaveClass(/on/);
  await expect.poll(async () => Number(await page.locator("#stage").evaluate((s) => getComputedStyle(s).getPropertyValue("--impact") || "0"))).toBe(0);
});

test("the next chip chains without Oss!, a move picked from the panel opens with it", async ({ page }) => {
  await open(page, ARMBAR, { oss: true, query: "frame=0" });
  const chip = page.locator("#next-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("próximo");
  const before = await page.locator("#title").textContent();

  await chip.click();
  await expect(page.locator("#title")).not.toHaveText(before!);
  await expect(page).toHaveURL(/#t\/\d+/);
  await expect(page.locator("#play")).toHaveText("❚❚");
  await expect(page.locator("#oss")).toBeHidden();

  // Not chaining: a fight started from the panel greets first.
  await page.locator("#menu").click();
  await page.locator("#panel-body .rows a").filter({ hasText: "Montagem da chave de braço" }).first().click();
  await expect(page.locator("#oss")).toBeVisible();
  await expect(page.locator("#oss")).toBeHidden();
  await expect(page.locator("#play")).toHaveText("❚❚");
});
