// The local editor's back end: two endpoints added to the dev server (vite.config.ts) that
// read and write our additions to GrappleMap and rebuild graph.json after a save. It runs
// only under `vite` (dev); nothing of it is in a build.

import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
type Rebuild = (done: (ok: boolean, log: string) => void) => void;

export interface EditorServerOptions {
  /** The additions file (data/grapplemap/bjj-3d.txt). */
  additions: string;
  /** Rebuilds graph.json; by default runs scripts/build-data.ts in `cwd`. */
  rebuild?: Rebuild;
  cwd?: string;
}

/** Runs the data build as a child process and reports its output. */
export function buildData(cwd: string, env: NodeJS.ProcessEnv = process.env): Rebuild {
  return (done) => execFile("node", ["scripts/build-data.ts"], { cwd, env }, (error, stdout, stderr) => done(!error, (stdout + stderr).trim()));
}

/** The two endpoints, as plain request handlers. */
export function editorHandlers(options: EditorServerOptions): Record<string, Handler> {
  const rebuild = options.rebuild ?? buildData(options.cwd ?? process.cwd());
  return {
    "/__editor/additions": (req, res) => {
      if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(existsSync(options.additions) ? readFileSync(options.additions, "utf8") : "");
    },
    "/__editor/save": (req, res) => {
      if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        writeFileSync(options.additions, body);
        rebuild((ok, log) => {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok, log }));
        });
      });
    },
  };
}

/** The Vite plugin: the endpoints on the dev server only (`apply: "serve"`). */
export function editorServer(options: EditorServerOptions): Plugin {
  return {
    name: "bjj-3d-editor",
    apply: "serve",
    configureServer(server) {
      for (const [path, handler] of Object.entries(editorHandlers(options))) server.middlewares.use(path, handler);
    },
  };
}
