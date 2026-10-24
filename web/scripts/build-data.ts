// Builds web/public/graph.json: every GrappleMap position and transition, plus our own
// additions (data/grapplemap/bjj-3d.txt, same format, written by the local editor), with
// the submission kind of each transition and the reviewed techniques merged on top.
// Poses go through the contact solver (src/contact.ts) first, so the bodies drawn over
// them do not sink into each other, and transitions get in-between frames. Solved poses
// are cached in web/.cache by their input, so a rebuild after an edit takes seconds.
//   node scripts/build-data.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { ContactSolver, SUBSTEPS } from "../src/contact.ts";
import { buildGraph, encodePose, parse } from "../src/grapplemap.ts";
import { submissionKind } from "../src/metrics.ts";
import type { GraphFile, TechniqueFile } from "../src/data.ts";

const root = new URL("../../", import.meta.url);
const additionsFile = new URL("data/grapplemap/bjj-3d.txt", root);
const text = readFileSync(new URL("data/grapplemap/GrappleMap.txt", root), "utf8") + "\n" + (existsSync(additionsFile) ? readFileSync(additionsFile, "utf8") : "");
const graph = buildGraph(parse(text));
const solver = new ContactSolver(JSON.parse(readFileSync(new URL("data/body/capsules.json", root), "utf8")));

const cacheFile = new URL("web/.cache/solved.json", root);
const cache: Record<string, string[]> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
let hits = 0;
/** Solved, densified poses for a block, from the cache when its input is unchanged. */
function solved(encoded: string[], run: () => string[]): string[] {
  const key = encoded.join("|");
  if (cache[key]) { hits++; return cache[key]; }
  return (cache[key] = run());
}

const out: GraphFile = {
  substeps: SUBSTEPS,
  positions: graph.positions.map((b) => ({
    name: b.name, description: b.description.slice(1).map((l) => l.replaceAll("\\n", " ")), tags: b.tags, refs: b.refs, line: b.line, pose: solved(b.encoded, () => [encodePose(solver.pose(b.poses[0]))])[0],
  })),
  transitions: graph.transitions.map((t) => ({
    name: t.block.name,
    description: t.block.description.slice(1).map((l) => l.replaceAll("\\n", " ")),
    tags: t.block.tags,
    properties: t.block.properties,
    refs: t.block.refs,
    line: t.block.line,
    from: t.from,
    to: t.to,
    kind: submissionKind(t.block.tags, t.from === null ? [] : graph.positions[t.from].tags, t.to === null ? [] : graph.positions[t.to].tags),
    poses: solved(t.block.encoded, () => solver.transition(t.block.poses).map(encodePose)),
  })),
  techniques: {},
};

for (const file of readdirSync(new URL("data/techniques/", root)).filter((f) => f.endsWith(".json"))) {
  const spec = JSON.parse(readFileSync(new URL(`data/techniques/${file}`, root), "utf8")) as TechniqueFile;
  const i = out.transitions.findIndex((t) => t.line === spec.source.grapplemap_line);
  if (i < 0) throw new Error(`${file}: no transition at line ${spec.source.grapplemap_line}`);
  const t = out.transitions[i];
  const name = (p: number | null) => (p === null ? null : out.positions[p].name);
  if (name(t.from) !== spec.source.from || name(t.to) !== spec.source.to)
    throw new Error(`${file}: line ${spec.source.grapplemap_line} goes ${name(t.from)} -> ${name(t.to)}`);
  out.techniques[i] = spec;
}

writeFileSync(new URL("web/public/graph.json", root), JSON.stringify(out));
mkdirSync(new URL("web/.cache/", root), { recursive: true });
writeFileSync(cacheFile, JSON.stringify(cache));
const kinds = out.transitions.filter((t) => t.kind).length;
console.log(`graph.json: ${out.positions.length} positions, ${out.transitions.length} transitions (${kinds} with a submission kind), ${Object.keys(out.techniques).length} reviewed-technique files; ${hits} solved poses from the cache`);
