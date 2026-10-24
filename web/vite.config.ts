import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const root = new URL("../", import.meta.url);
const additions = fileURLToPath(new URL("data/grapplemap/bjj-3d.txt", root));

/**
 * The local editor's back end, for `vite` (dev) only: reads and writes our additions to
 * GrappleMap and rebuilds graph.json after a save. Nothing of this exists in a build.
 */
function editorServer(): Plugin {
  return {
    name: "bjj-3d-editor",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__editor/additions", (req, res) => {
        if (req.method !== "GET") { res.statusCode = 405; return res.end(); }
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end(existsSync(additions) ? readFileSync(additions, "utf8") : "");
      });
      server.middlewares.use("/__editor/save", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          writeFileSync(additions, body);
          execFile("node", ["scripts/build-data.ts"], { cwd: fileURLToPath(new URL("web/", root)) }, (error, stdout, stderr) => {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: !error, log: (stdout + stderr).trim() }));
          });
        });
      });
    },
  };
}

// Relative base so the build works from any path (GitHub Pages serves it under /bjj-3d/).
export default defineConfig({
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 800 },
  plugins: [editorServer()],
});
