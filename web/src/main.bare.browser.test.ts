// The page with the least to work with: no matchMedia, unreadable saved settings, storage
// that refuses writes, a production build (no editor), no ?debug, and a graph with neither
// reviewed techniques nor the standing position the fighter screen needs.

import { expect, test, vi } from "vitest";
import { $, boot, realGraph, SETTINGS_KEY } from "./test/app-harness.ts";

// Booting the page and drawing it in software WebGL is slow on a busy machine.
vi.setConfig({ testTimeout: 120_000 });

const graph = await realGraph();
vi.stubEnv("DEV", false);
await boot({
  search: "",
  hash: "t/999999",
  settings: "{not json",
  graph: (g) => {
    g.techniques = {};
    for (const p of g.positions) if (p.name === "staredown") p.name = "standing apart";
  },
  before: () => {
    Object.defineProperty(window, "matchMedia", { value: undefined, configurable: true });
    Storage.prototype.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
  },
});

test("it still opens: the first position, light theme, nothing saved", () => {
  expect($("#title").textContent).toBe(graph.positions[0].name);
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem(SETTINGS_KEY)).toBe("{not json");
  $("#theme").click();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("no fighter screen without a standing pose, no editor outside dev, no debug global", () => {
  expect($("#fighters-btn").hidden).toBe(true);
  expect($("#settings .actions").textContent).not.toContain("Editor");
  expect("viewer" in window).toBe(false);
});
