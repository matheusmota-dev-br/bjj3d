// Prints the raw measures of every metric over submission transitions and over the
// rest of the database, to choose thresholds. Measured after the contact solver, as the
// viewer shows the poses.
//   node scripts/calibrate.ts
import { readFileSync } from "node:fs";
import { ContactSolver } from "@bjj3d/core/contact";
import { buildGraph, parse } from "@bjj3d/grapplemap";
import { chokeGap, flexion, KIND_BY_TAG, kneeTwist, landmarksFromPlayer, shoulderRotation, type Kind } from "@bjj3d/metrics";

const graph = buildGraph(parse(readFileSync(new URL("../../../data/grapplemap/GrappleMap.txt", import.meta.url), "utf8")));
const solver = new ContactSolver(JSON.parse(readFileSync(new URL("../../../data/body/capsules.json", import.meta.url), "utf8")));
const solved = graph.transitions.map((t) => solver.transition(t.block.poses));

type Measure = (poses: ReturnType<typeof landmarksFromPlayer>[][]) => number;
const sides = ["Left", "Right"] as const;

const MEASURES: Record<Kind, { label: string; at: Measure }> = {
  elbow: { label: "min elbow flexion", at: (fr) => Math.min(...fr.flatMap((pl) => pl.flatMap((l) => sides.map((s) => flexion(l[`${s}Shoulder`], l[`${s}Elbow`], l[`${s}Wrist`]))))) },
  knee: { label: "min knee flexion", at: (fr) => Math.min(...fr.flatMap((pl) => pl.flatMap((l) => sides.map((s) => flexion(l[`${s}Hip`], l[`${s}Knee`], l[`${s}Ankle`]))))) },
  shoulder: { label: "max internal rotation", at: (fr) => Math.max(...fr.flatMap((pl) => pl.flatMap((l) => sides.map((s) => { const r = shoulderRotation(l, s); return r.confidence > 0.5 ? r.angle : -999; })))) },
  kneeTwist: { label: "max knee twist", at: (fr) => Math.max(...fr.flatMap((pl) => pl.flatMap((l) => sides.map((s) => { const r = kneeTwist(l, s); return r.confidence > 0.5 ? r.angle : 0; })))) },
  choke: { label: "min choke gap (m)", at: (fr) => Math.min(...fr.flatMap(([a, b]) => [chokeGap(a, b), chokeGap(b, a)])) },
  neckCrank: { label: "max neck flexion", at: (fr) => Math.max(...fr.flatMap((pl) => pl.map((l) => flexion(l.Core, l.Neck, l.Head)))) },
};

const kindOf = (tags: string[]) => tags.map((t) => KIND_BY_TAG[t]).find(Boolean);
const q = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const fmt = (x: number) => (Math.abs(x) < 2 ? x.toFixed(3) : x.toFixed(0));

for (const kind of Object.keys(MEASURES) as Kind[]) {
  const m = MEASURES[kind];
  const sub: number[] = [], finish: string[] = [], rest: number[] = [];
  for (const [ti, t] of graph.transitions.entries()) {
    const frames = solved[ti].map((p) => p.map(landmarksFromPlayer));
    const k = kindOf([...t.block.tags, ...(t.from !== null ? graph.positions[t.from].tags : []), ...(t.to !== null ? graph.positions[t.to].tags : [])]);
    const x = m.at(frames);
    if (k === kind) {
      sub.push(x);
      if (/tap|finish|submit/i.test(t.block.name)) finish.push(`${t.block.line}:${fmt(x)}`);
    } else if (!k) rest.push(x);
  }
  console.log(`${kind} (${m.label}): ${sub.length} transitions; median ${fmt(q(sub, 0.5))}, p10 ${fmt(q(sub, 0.1))}, p90 ${fmt(q(sub, 0.9))} | others p5 ${fmt(q(rest, 0.05))} median ${fmt(q(rest, 0.5))} p95 ${fmt(q(rest, 0.95))}`);
  if (finish.length) console.log("   finishes:", finish.join(" "));
}
