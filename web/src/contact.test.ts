import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ContactSolver, deepestOverlap, SUBSTEPS } from "./contact.ts";
import { buildGraph, isReoriented, parse } from "./grapplemap.ts";

const graph = buildGraph(parse(readFileSync(new URL("../../data/grapplemap/GrappleMap.txt", import.meta.url), "utf8")));
const radii = JSON.parse(readFileSync(new URL("../../data/body/capsules.json", import.meta.url), "utf8"));
const solver = new ContactSolver(radii);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

test("solving removes most of the overlap between the bodies", () => {
  const sample = graph.transitions.filter((_, i) => i % 15 === 0);
  const before = sample.map((t) => Math.max(...t.block.poses.map((p) => deepestOverlap(p, radii))));
  const after = sample.map((t) => Math.max(...solver.transition(t.block.poses).map((p) => deepestOverlap(p, radii))));
  assert.ok(median(before) > 0.04, `median overlap before: ${median(before)}`);
  assert.ok(median(after) < 0.02, `median overlap after: ${median(after)}`);
});

test("a transition gains in-between frames and keeps its keyframe count", () => {
  const t = graph.transitions[0].block.poses;
  assert.equal(solver.transition(t).length, (t.length - 1) * SUBSTEPS + 1);
});

test("solved transitions still continue from where the previous one ended", () => {
  // Ends are solved on their own, so the same pose gives nearly the same result in every
  // transition that starts or ends there. GrappleMap itself lets shared ends differ by
  // 4 cm; after solving a few differ by up to about 5.5 cm, which the viewer allows (10 cm)
  // and fades out.
  let pairs = 0;
  for (const a of graph.transitions) {
    if (a.to === null) continue;
    const end = solver.pose(a.block.poses.at(-1)!);
    for (const b of graph.transitions.filter((t) => t.from === a.to)) {
      assert.ok(isReoriented(solver.pose(b.block.poses[0]), end, 0.1), `line ${b.block.line} after line ${a.block.line}`);
      pairs++;
    }
  }
  assert.ok(pairs > 2000);
});
