import { defineConfig } from "vite";

// Relative base so the build works from any path (GitHub Pages serves it under /bjj-3d/).
export default defineConfig({
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 800 },
});
