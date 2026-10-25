// The local editor, end to end: pose, save, rebuild, find the new move and play it. Saving
// writes the scratch additions file and the scratch graph (see playwright.config.ts).
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ADDITIONS, GRAPH } from "../playwright.config.ts";
import { open } from "./helpers.ts";

const transitionsIn = () => JSON.parse(readFileSync(GRAPH, "utf8")).transitions as { name: string; tags: string[]; poses: string[] }[];

async function openEditor(page: Page) {
  await page.locator("#settings-btn").click();
  await page.getByRole("button", { name: "✎ Editor" }).click();
  const editor = page.locator(".customizer.editor");
  await expect(editor).toBeVisible();
  await expect(editor.locator(".preset").first()).toBeVisible();
  return editor;
}

/** Screen position of a joint of the frame being edited, from the live camera. */
const jointOnScreen = (page: Page, player: number, joint: string) =>
  page.evaluate(([player, joint]) => {
    type V = { x: number; y: number; z: number; project(c: unknown): V };
    const v = (window as unknown as { viewer: { currentPoses: Record<string, number[]>[][]; time: number; camera: { position: { constructor: new (x: number, y: number, z: number) => V } }; canvas: HTMLCanvasElement } }).viewer;
    const p = v.currentPoses[Math.round(v.time)][player as number][joint as string];
    const Vec = v.camera.position.constructor;
    const s = new Vec(p[0], p[1], p[2]).project(v.camera);
    const r = v.canvas.getBoundingClientRect();
    return { x: r.left + ((s.x + 1) / 2) * r.width, y: r.top + ((1 - s.y) / 2) * r.height };
  }, [player, joint] as const);

test("a new transition from a neutral position is posed, saved, rebuilt, found and played", async ({ page }) => {
  const name = `e2e side control drill ${Date.now()}`;
  const before = transitionsIn().length;
  await open(page, "", { query: "debug=1" });
  const editor = await openEditor(page);

  // Start from side control: two equal frames, the position's tags, the first frame matching it.
  await editor.locator(".preset", { hasText: "Cem quilos" }).click();
  await expect(editor.locator(".seg.wrap button")).toHaveCount(2);
  await expect(editor.getByText(/Primeiro quadro: coincide com/)).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/studio/);

  // Second frame: drag the blue fighter's left wrist; the bone lengths hold.
  await editor.locator(".seg.wrap button").nth(1).click();
  const from = await jointOnScreen(page, 1, "LeftWrist");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y - 50, { steps: 10 });
  await page.mouse.up();
  const to = await jointOnScreen(page, 1, "LeftWrist");
  expect(Math.hypot(to.x - from.x, to.y - from.y)).toBeGreaterThan(20);

  // A third frame, then the details.
  await editor.getByRole("button", { name: /Duplicar/ }).click();
  await expect(editor.locator(".seg.wrap button")).toHaveCount(3);
  await editor.getByPlaceholder("Nome").fill(name);
  await editor.getByPlaceholder("closed_guard armbar").fill("side_control e2e");
  await editor.getByRole("button", { name: "de cima" }).click();
  await editor.getByPlaceholder("https://…").fill("bjj3d end-to-end test");

  // Save: the dev server writes the additions, rebuilds the graph, the page reloads into the editor.
  await editor.getByRole("button", { name: "Salvar e reconstruir" }).click();
  await expect(editor.getByText(/Salvo/)).toBeVisible({ timeout: 30_000 });
  await page.waitForEvent("load");
  const reopened = page.locator(".customizer.editor");
  await expect(reopened.getByPlaceholder("Nome")).toHaveValue(name);
  await expect(reopened.locator(".seg.wrap button")).toHaveCount(3);

  // The additions file holds the block in GrappleMap's format…
  const text = readFileSync(ADDITIONS, "utf8");
  const lines = text.split("\n");
  const at = lines.indexOf(name);
  expect(at).toBeGreaterThanOrEqual(0);
  expect(lines[at + 1]).toBe("tags: side_control e2e");
  expect(lines[at + 2]).toBe("properties: top");
  expect(lines[at + 3]).toBe("ref: bjj3d end-to-end test");
  const poseLines = lines.slice(at + 4).filter((l) => l.startsWith("    "));
  expect(poseLines).toHaveLength(3 * 4);
  for (const l of poseLines) expect(l).toMatch(/^ {4}[0-9A-Za-z]{1,69}$/);

  // …and the rebuilt graph has one more transition, with that name and tags.
  const after = transitionsIn();
  expect(after.length).toBe(before + 1);
  expect(after.at(-1)).toMatchObject({ name, tags: ["side_control", "e2e"] });

  // Close the editor, find the new move in the panel and play it.
  await reopened.getByRole("button", { name: "Fechar" }).click();
  await expect(reopened).toBeHidden();
  await page.locator("#menu").click();
  await page.locator("#search").fill("side control drill");
  const hit = page.locator("#panel-body .rows a", { hasText: name });
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page.locator("#title")).toHaveText(name);
  await expect(page.locator("#thumbs .thumb")).toHaveCount(3);
  // It plays on opening; once it ends, play runs it again from the start.
  await expect(page.locator("#play")).toHaveText("▶");
  const last = await page.evaluate(() => (window as unknown as { viewer: { last: number } }).viewer.last);
  expect(last).toBe(2);
  await page.locator("#play").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { viewer: { time: number } }).viewer.time), { intervals: [50] }).toBeLessThan(2);
  await expect.poll(() => page.evaluate(() => (window as unknown as { viewer: { time: number } }).viewer.time)).toBe(2);
});

test("a copy of an existing transition loads its keyframes, tags and ends", async ({ page }) => {
  await open(page, "", { query: "debug=1" });
  const editor = await openEditor(page);
  await editor.getByPlaceholder("Buscar transições…").fill("kimura");
  const results = editor.locator(".choices button", { hasText: "→" });
  await expect(results.first()).toBeVisible();
  const label = (await results.first().textContent())!;
  await results.first().click();

  const original = label.split(" · ")[0];
  await expect(editor.getByPlaceholder("Nome")).toHaveValue(`cópia de ${original}`);
  expect(await editor.locator(".seg.wrap button").count()).toBeGreaterThan(1);
  const source = transitionsIn().find((t) => t.name === original)!;
  await expect(editor.getByPlaceholder("closed_guard armbar")).toHaveValue(source.tags.join(" "));
  await expect(editor.getByText(/Primeiro quadro: coincide com/)).toBeVisible();
  await expect(editor.getByText(/Último quadro:/)).toBeVisible();

  // Mirror and swap act on every frame; closing leaves the scratch data untouched.
  const additions = readFileSync(ADDITIONS, "utf8");
  await editor.getByRole("button", { name: "Espelhar" }).click();
  await editor.getByRole("button", { name: "Trocar lutadores" }).click();
  await editor.getByRole("button", { name: "Fechar" }).click();
  await expect(editor).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/studio/);
  expect(readFileSync(ADDITIONS, "utf8")).toBe(additions);
});

test("appending an existing position ends a new transition on it", async ({ page }) => {
  await open(page, "", { query: "debug=1" });
  const editor = await openEditor(page);
  await editor.locator(".preset", { hasText: "Montada" }).click();
  await editor.getByPlaceholder("Buscar posições…").fill("mount w/ head");
  await editor.locator(".choices button", { hasText: "mount w/ head&arm" }).first().click();
  await expect(editor.locator(".seg.wrap button")).toHaveCount(3);
  await expect(editor.getByText(/Último quadro: coincide com "mount w\/ head&arm"/)).toBeVisible();
  await editor.getByRole("button", { name: /Apagar/ }).click();
  await expect(editor.locator(".seg.wrap button")).toHaveCount(2);
});
