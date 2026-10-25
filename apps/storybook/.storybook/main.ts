// The catalog: the packages as a third party sees them (imported by name, never by path),
// organized by atomic design, with the engine and the guides beside it.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/html-vite";

const web = (p: string) => fileURLToPath(new URL(`../../web/${p}`, import.meta.url));

// The Pages level shows the site's production build; make it once if it is not there
// (`npm run build` refreshes it after changes to the site).
if (!existsSync(web("dist/index.html"))) {
  execFileSync("npm", ["run", "build", "-w", "@bjj3d/web"], { cwd: fileURLToPath(new URL("../../../", import.meta.url)), stdio: "inherit" });
}

const config: StorybookConfig = {
  framework: "@storybook/html-vite",
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.ts"],
  addons: ["@storybook/addon-docs"],
  staticDirs: [
    // graph.json (npm run data) and the icons.
    web("public"),
    // The built site, for the Pages level.
    { from: web("dist"), to: "/site" },
  ],
};

export default config;
