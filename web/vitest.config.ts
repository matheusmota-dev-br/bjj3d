import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Two kinds of unit test: plain modules run in Node; anything that needs WebGL or the DOM
// (*.browser.test.ts) runs in headless Chromium. Coverage is measured over both, and must
// stay at 100%.
export default defineConfig({
  test: {
    projects: [
      { test: { name: "node", include: ["src/**/*.test.ts"], exclude: ["src/**/*.browser.test.ts"], environment: "node", testTimeout: 60_000 } },
      {
        publicDir: "public",
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          testTimeout: 60_000,
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }], viewport: { width: 1280, height: 800 } },
        },
      },
    ],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/test/**"],
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage/unit",
      thresholds: { 100: true },
    },
  },
});
