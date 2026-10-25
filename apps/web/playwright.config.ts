import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// End-to-end: the real app on a dedicated dev server, driven like a person would. The data
// is a scratch copy (BJJ3D_ADDITIONS, BJJ3D_GRAPH), so saving from the editor never touches
// data/grapplemap/bjj3d.txt nor public/graph.json; global-teardown checks that.
export const PORT = 5181;
export const SCRATCH = join(tmpdir(), "bjj3d-e2e");
export const ADDITIONS = join(SCRATCH, "additions.txt");
export const GRAPH = fileURLToPath(new URL("public/e2e/graph.json", import.meta.url));
process.env.BJJ3D_ADDITIONS = ADDITIONS;
process.env.BJJ3D_GRAPH = GRAPH;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // The editor test writes the shared scratch data; one worker keeps the order simple.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    // The full Chromium in new headless mode renders WebGL on the GPU when there is one
    // (60 fps here); the default headless shell falls back to SwiftShader (about 1 fps).
    channel: "chromium",
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { BJJ3D_ADDITIONS: ADDITIONS, BJJ3D_GRAPH: GRAPH },
  },
});
