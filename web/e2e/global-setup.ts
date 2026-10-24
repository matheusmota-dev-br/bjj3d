// Before the suite: an empty scratch additions file, a graph built from it into public/e2e/,
// and fingerprints of the real data so global-teardown can prove the suite left it alone.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ADDITIONS, GRAPH, SCRATCH } from "../playwright.config.ts";

export const REAL = ["../../data/grapplemap/bjj-3d.txt", "../public/graph.json"].map((p) => fileURLToPath(new URL(p, import.meta.url)));
export const FINGERPRINTS = `${SCRATCH}/real-data.json`;
export const fingerprint = (path: string) => (existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : "missing");

export default function setup() {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(ADDITIONS, "");
  writeFileSync(FINGERPRINTS, JSON.stringify(Object.fromEntries(REAL.map((p) => [p, fingerprint(p)]))));
  execFileSync("node", ["scripts/build-data.ts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, BJJ3D_ADDITIONS: ADDITIONS, BJJ3D_GRAPH: GRAPH },
    stdio: "inherit",
  });
}
