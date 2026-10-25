// Takes the README's screenshots from the running viewer, in English, with Playwright's Chromium:
//
//   docs/screens/watch.png      a move playing, with the filmstrip
//   docs/screens/finish.png     inside the lock: the notice and the ring on the attacked joint
//   docs/screens/browse.png     the panel, on the finishes tab
//   docs/screens/fighters.png   the fighters screen
//   docs/screens/phone.png      a phone-sized screen, dark theme
//   docs/screens/look-*.png     the three looks, interface hidden
//   docs/screens/place-*.png    the four places, interface hidden
//
// Needs the viewer running (pnpm dev):
//   node tools/screens.mjs [http://localhost:5173]
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const base = process.argv[2] ?? "http://localhost:5173";
const out = (name) => new URL(`docs/screens/${name}.png`, root).pathname;
mkdirSync(new URL("docs/screens/", root), { recursive: true });

// The knee-on-belly armbar (GrappleMap line 14237): a reviewed technique whose lock reaches the
// danger range.
const graph = JSON.parse(readFileSync(new URL("apps/web/public/graph.json", root), "utf8"));
const armbar = graph.transitions.findIndex((t) => t.line === 14237);
const HIDE_UI = "#panel,.top-left,.top-right,.player,#help,#vignette,#camchip{display:none!important}";

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function shot(name, { settings = {}, hash = `t/${armbar}`, query = "", size = [1280, 720], scale = 1, hideUi = false, then } = {}) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: scale });
  await page.addInitScript((s) => localStorage.setItem("bjj3d.settings.v2", JSON.stringify(s)), {
    lang: "en", theme: "light", look: "solid", place: "mat", camera: "directed", helpSeen: true, oss: false, ...settings,
  });
  await page.goto(`${base}/${query ? `?${query}` : ""}#${hash}`);
  await page.locator("#thumbs .thumb").first().waitFor();
  if (hideUi) await page.addStyleTag({ content: HIDE_UI });
  if (then) await then(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out(name) });
  await page.close();
  console.log("wrote", `docs/screens/${name}.png`);
}

await shot("watch", { query: "frame=3" });
await shot("finish", { query: "frame=8" });
await shot("browse", {
  query: "frame=8",
  then: async (page) => {
    await page.locator("#menu").click();
    await page.getByRole("tab", { name: "Finishes" }).click();
  },
});
await shot("fighters", {
  query: "frame=0",
  settings: { fighters: [{ build: 1.15, belt: "black" }, { belt: "purple" }] },
  then: async (page) => {
    await page.locator("#settings-btn").click();
    await page.getByRole("button", { name: /Fighters/ }).click();
  },
});
await shot("phone", { query: "frame=8", settings: { theme: "dark" }, size: [390, 844], scale: 2 });
for (const look of ["solid", "wood", "hologram"])
  await shot(`look-${look}`, { query: "frame=8", settings: { look, place: "night" }, size: [640, 480], hideUi: true });
for (const place of ["mat", "gym", "studio", "night"])
  await shot(`place-${place}`, { query: "frame=3", settings: { place }, size: [640, 480], hideUi: true });

await browser.close();
