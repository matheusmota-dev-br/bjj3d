// A returning visitor: settings saved by an older version (a look and a camera that no
// longer exist, one fighter customized past the limits), a dark system theme, a reviewed
// technique with its own risk line, and an address that opens paused at a keyframe.

import { expect, test, vi } from "vitest";
import { $, $$, boot, frame, go, SETTINGS_KEY } from "./test/app-harness.ts";

// Booting the page and drawing it in software WebGL is slow on a busy machine.
vi.setConfig({ testTimeout: 120_000 });

const { viewer } = await boot({
  search: "?debug=1&frame=2",
  hash: "t/458",
  settings: { look: "x-ray", camera: "orbit", eyesOf: "0", helpSeen: true, fighters: [{ build: 5, belt: "blue" }] },
  graph: (g) => Object.assign(g.techniques[458], { reviewed: true, risk: { en: "Careful.", "pt-BR": "Cuidado." } }),
  before: () => { window.matchMedia = ((q: string) => ({ matches: true, media: q })) as unknown as typeof matchMedia; },
});
const saved = () => JSON.parse(localStorage.getItem(SETTINGS_KEY)!);

test("old values fall back to the defaults, and the address opens paused, without Oss!", () => {
  expect(viewer.look).toBe("solid");
  expect(viewer.cameraMode).toBe("directed");
  expect($("#help").hidden).toBe(true);
  expect($("#oss").hidden).toBe(true);
  expect(viewer.time).toBe(2);
  expect(viewer.playing).toBe(false);
  // The system prefers dark, and nothing saved says otherwise.
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("a reviewed technique: no draft note, its own risk line", () => {
  expect($$(".now .note").map((p) => p.textContent)).not.toContain("Texto provisório, ainda não revisado.");
  viewer.onFrame(frame({ reading: { value: 0.9, danger: true, measure: 10 }, joint: { x: 1, y: 1 } }));
  expect($("#risk").textContent).toBe("Cuidado.");
});

test("the fighters keep what was saved, within the limits", () => {
  $("#fighters-btn").click();
  expect($<HTMLInputElement>("#cz-body input[type=range]").value).toBe("1.2");
  expect($("#cz-body .choices [aria-pressed=true]").textContent).toContain("Azul");
  $$<HTMLButtonElement>("#cz-tabs button")[1].click();
  expect($<HTMLInputElement>("#cz-body input[type=range]").value).toBe("1");
  expect($("#cz-body .choices [aria-pressed=true]").textContent).toContain("Branca");
  $("#cz-done").click();
  expect(saved().fighters).toEqual([{ build: 1.2, belt: "blue" }, { build: 1, belt: "white" }]);
});

test("the eyes camera follows the saved fighter", () => {
  $('#camera [data-value="eyes"]').click();
  expect(viewer.cameraMode).toBe("eyes0");
});

test("on a still position the help closes without Oss!; a new move then opens with it", async () => {
  await go("p/401");
  $("#help-btn").click();
  $("#help-ok").click();
  expect($("#oss").hidden).toBe(true);
  await go("t/458");
  expect($("#oss").hidden).toBe(false);
});
