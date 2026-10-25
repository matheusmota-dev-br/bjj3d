// A visitor from before the rename: settings saved under the old key (bjj-3d.settings.v2)
// and nothing under the new one.

import { expect, test, vi } from "vitest";
import { boot } from "./test/app-harness.ts";

// Booting the page and drawing it in software WebGL is slow on a busy machine.
vi.setConfig({ testTimeout: 120_000 });

const { viewer } = await boot({
  before: () => localStorage.setItem("bjj-3d.settings.v2", JSON.stringify({ look: "wood", helpSeen: true, oss: false })),
});

test("the settings saved under the old name still apply", () => {
  expect(viewer.look).toBe("wood");
});
