import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { editorServer } from "./src/editor-server.ts";

const root = new URL("../", import.meta.url);

// Relative base so the build works from any path (GitHub Pages serves it under /bjj-3d/).
// BJJ3D_ADDITIONS points the local editor at another additions file (the end-to-end tests use
// a scratch copy, so they never touch the real data).
export default defineConfig({
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 800 },
  plugins: [
    editorServer({
      additions: process.env.BJJ3D_ADDITIONS ?? fileURLToPath(new URL("data/grapplemap/bjj-3d.txt", root)),
      cwd: fileURLToPath(new URL("web/", root)),
    }),
  ],
});
