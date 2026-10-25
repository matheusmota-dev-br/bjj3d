// The published site: built with `vite build` and served by `vite preview`, it has no editor.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const web = fileURLToPath(new URL("..", import.meta.url));
const PORT = 5182;
let out = "";
let preview: ChildProcess | undefined;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  out = mkdtempSync(join(tmpdir(), "bjj3d-build-"));
  execFileSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir"], { cwd: web, stdio: "pipe" });
  preview = spawn("npx", ["vite", "preview", "--outDir", out, "--port", String(PORT), "--strictPort"], { cwd: web, stdio: "pipe" });
  await expect.poll(async () => fetch(`http://localhost:${PORT}/`).then((r) => r.ok, () => false), { timeout: 30_000 }).toBe(true);
});

test.afterAll(() => {
  preview?.kill();
  if (out) rmSync(out, { recursive: true, force: true });
});

test("the production bundle carries no editor code", () => {
  const js = readdirSync(join(out, "assets")).filter((f) => f.endsWith(".js"));
  expect(js.length).toBeGreaterThan(0);
  for (const f of js) {
    const code = readFileSync(join(out, "assets", f), "utf8");
    expect(code).not.toContain("__editor");
    expect(code).not.toContain("Editor (local)");
  }
});

test("the production page works and offers no editor", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bjj3d.settings.v2", JSON.stringify({ helpSeen: true, oss: false })));
  await page.goto(`http://localhost:${PORT}/?graph=e2e/graph.json#t/458`);
  await expect(page.locator("#thumbs .thumb").first()).toBeVisible();
  await expect(page.locator("#title")).toHaveText("Chave de braço do joelho na barriga");
  await page.locator("#settings-btn").click();
  await expect(page.locator("#settings")).toBeVisible();
  await expect(page.getByRole("button", { name: /Editor/ })).toHaveCount(0);
  // No editor endpoints either: preview answers unknown paths with the page itself.
  const res = await fetch(`http://localhost:${PORT}/__editor/additions`);
  expect(res.headers.get("content-type")).toMatch(/text\/html/);
});
