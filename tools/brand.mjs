// Draws the identity from the tool itself, with headless Chrome over the DevTools protocol:
//
//   docs/render.png                 a frame of the knee-on-belly armbar, interface hidden
//                                   (settings cleared first, so the saved look does not leak in)
//   docs/banner.png                 tools/banner.html (name, tagline, the render)
//   apps/web/public/apple-touch-icon.png tools/icon.svg at 180 px
//   apps/web/public/favicon-32.png  apps/web/public/favicon.svg at 32 px
//
// Needs the viewer running (pnpm dev):
//   node tools/brand.mjs [http://localhost:5173]   CHROME=/path/to/chrome to override
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const base = process.argv[2] ?? "http://localhost:5173";
const chromePath = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "bjj3d-brand-"));
const chrome = spawn(chromePath, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* starting */ }
  if (!wsUrl) await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let next = 0;
const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d.result); waiting.delete(d.id); };
const send = (method, params = {}) => new Promise((r) => { const id = ++next; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true });

async function capture(url, width, height, out, { transparent = false, settle = 1500, script } = {}) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setDefaultBackgroundColorOverride", transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
  await send("Page.navigate", { url });
  await sleep(settle);
  if (script) { await evaluate(script); await sleep(2500); }
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(new URL(out, root), Buffer.from(shot.data, "base64"));
  console.log("wrote", out);
}

// The armbar's index in graph.json (GrappleMap line 14237).
const graph = JSON.parse(readFileSync(new URL("apps/web/public/graph.json", root), "utf8"));
const armbar = graph.transitions.findIndex((t) => t.line === 14237);

await send("Page.enable");
await send("Page.navigate", { url: `${base}/` });
await sleep(2500);
await evaluate("localStorage.clear()");
await capture(`${base}/?frame=8#t/${armbar}`, 1280, 720, "docs/render.png", {
  settle: 6000,
  script: `(async () => {
    // The page builds its controls once graph.json is in; on a slow machine that is after settle.
    while (!document.querySelector('#look [data-value="solid"]')) await new Promise((r) => setTimeout(r, 100));
    // The identity: solid mannequins on the dark grid, the directed camera, the lock lit.
    document.querySelector('#look [data-value="solid"]').click();
    document.querySelector('#place [data-value="night"]').click();
    document.querySelector('#camera [data-value="directed"]').click();
    document.querySelector("#help-ok").click();
    const style = document.createElement("style");
    style.textContent = "#panel,.top-left,.top-right,.player,#help,#vignette{display:none!important}";
    document.head.append(style);
    dispatchEvent(new Event("resize"));
  })()`,
});
await capture(pathToFileURL(new URL("tools/banner.html", root).pathname).href, 1280, 320, "docs/banner.png", { settle: 2500 });

// An SVG without width/height fills the viewport, so the file itself is the page.
const svg = (path) => pathToFileURL(new URL(path, root).pathname).href;
await capture(svg("tools/icon.svg"), 180, 180, "apps/web/public/apple-touch-icon.png", { transparent: true, settle: 800 });
await capture(svg("apps/web/public/favicon.svg"), 32, 32, "apps/web/public/favicon-32.png", { transparent: true, settle: 800 });

ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
