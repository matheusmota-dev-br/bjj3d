import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Two kinds of unit test: plain modules run in Node; anything that needs WebGL or the DOM
// (*.browser.test.ts) runs in headless Chromium. Coverage is measured over both, and must
// stay at 100%, across every package and the site.
const TESTS = ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"];

export default defineConfig({
  test: {
    projects: [
      { test: { name: "node", include: TESTS, exclude: ["**/*.browser.test.ts"], environment: "node", testTimeout: 60_000 } },
      {
        publicDir: "apps/web/public",
        test: {
          name: "browser",
          include: TESTS.map((t) => t.replace(".test.ts", ".browser.test.ts")),
          testTimeout: 60_000,
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }], viewport: { width: 1280, height: 800 } },
        },
      },
    ],
    coverage: {
      provider: "istanbul",
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts", "**/src/test/**", "packages/core/src/testing/**"],
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage/unit",
      thresholds: { 100: true },
    },
  },
});
