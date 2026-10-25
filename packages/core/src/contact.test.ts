import { readFileSync } from "node:fs";
import { test } from "vitest";
import assert from "node:assert/strict";
import { ContactSolver, deepestOverlap, SUBSTEPS } from "./contact.ts";
import { basicallySame, isReoriented, JOINTS, mirror, type Pose } from "./pose.ts";
import { buildGraph, parse } from "@bjj3d/grapplemap";
import { apart, overlapping, standing, withJoints } from "./testing/poses.ts";

const graph = buildGraph(parse(readFileSync(new URL("../../../data/grapplemap/GrappleMap.txt", import.meta.url), "utf8")));
const radii = JSON.parse(readFileSync(new URL("../../../data/body/capsules.json", import.meta.url), "utf8"));
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

test("bodies that do not touch are left where they are", () => {
  const p = apart();
  assert.equal(deepestOverlap(p, radii), 0);
  assert.ok(basicallySame(solver.pose(p), p, 0.002));
});

test("two bodies in the same place are pushed apart, and stay above the mat", () => {
  const p = overlapping();
  assert.ok(deepestOverlap(p, radii) > 0.15);
  const q = solver.pose(p);
  assert.ok(deepestOverlap(q, radii) < 0.03);
  for (const pl of q) for (const j of JOINTS) assert.ok(pl[j][1] > 0.02, j);
});

test("bodies exactly on top of each other are still separated (vertically)", () => {
  // Every pair of matching capsules is at distance zero: the push has no direction of its
  // own, so it goes up.
  const p: Pose = [standing(), standing()];
  const q = solver.pose(p);
  assert.ok(Math.abs(q[0].Head[1] - q[1].Head[1]) > 0.01);
  assert.ok(deepestOverlap(q, radii) < deepestOverlap(p, radii));
});

test("solving keeps the bones at their length", () => {
  const p = overlapping();
  const q = solver.pose(p);
  const len = (pl: Pose[0]) => Math.hypot(...pl.LeftHip.map((v, i) => v - pl.LeftKnee[i]));
  assert.ok(Math.abs(len(q[0]) - len(p[0])) < 0.01);
});

test("a bone of zero length is left alone rather than divided by zero", () => {
  const folded = withJoints(standing(-0.5), { LeftHand: [...standing(-0.5).LeftWrist] });
  const q = solver.pose([folded, standing(0.5)]);
  for (const pl of q) for (const j of JOINTS) assert.ok(pl[j].every(Number.isFinite), j);
  assert.ok(Math.hypot(...q[0].LeftHand.map((v, i) => v - q[0].LeftWrist[i])) < 0.01);
});

test("a mirrored pose solves to the mirrored result", () => {
  const p = overlapping();
  assert.ok(basicallySame(solver.pose(mirror(p)), mirror(solver.pose(p)), 0.001));
});

test("a two-frame transition keeps both ends exactly as single poses solve them", () => {
  const keys = [apart(), overlapping()];
  const t = solver.transition(keys);
  assert.equal(t.length, SUBSTEPS + 1);
  assert.ok(basicallySame(t[0], solver.pose(keys[0]), 1e-9));
  assert.ok(basicallySame(t.at(-1)!, solver.pose(keys[1]), 1e-9));
});
