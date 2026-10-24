import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph, isReoriented, mirror, parse, reorient } from "./grapplemap.ts";

const text = readFileSync(new URL("../../data/grapplemap/GrappleMap.txt", import.meta.url), "utf8");
const blocks = parse(text);
const graph = buildGraph(blocks);

test("reads every position and transition", () => {
  assert.equal(graph.positions.length, 601);
  assert.equal(graph.transitions.length, 1485);
});

test("bones keep their length in almost every frame", () => {
  // A few hand-edited frames stretch a limb (thigh 0.366 to 0.473 m at the extremes);
  // 98% stay within 0.427 to 0.443 m, which is what makes the decoding trustworthy.
  const thigh = blocks.flatMap((b) => b.poses.flatMap((p) => p.map((pl) => Math.hypot(
    pl.LeftHip[0] - pl.LeftKnee[0], pl.LeftHip[1] - pl.LeftKnee[1], pl.LeftHip[2] - pl.LeftKnee[2])))).sort((a, b) => a - b);
  const q = (f: number) => thigh[Math.floor(f * thigh.length)];
  assert.ok(q(0.99) - q(0.01) < 0.02);
});

test("a rotated, shifted, mirrored, swapped pose is the same position", () => {
  const p = graph.positions[0].poses[0];
  const q = reorient(p, { offset: [0.3, 0, -0.7], angle: 1.1, mirror: true, swapPlayers: true });
  assert.ok(isReoriented(p, q));
  assert.ok(isReoriented(p, mirror(p)));
});

test("different positions do not match", () => {
  assert.equal(isReoriented(graph.positions[0].poses[0], graph.positions[1].poses[0]), null);
});

test("most transitions link to a position at both ends", () => {
  // Same figure the original tools and atlas-tatame report: 1246 of 1485.
  assert.equal(graph.transitions.filter((t) => t.from !== null && t.to !== null).length, 1246);
});

test("every transition continues from where the previous one ended", () => {
  // The viewer chains transitions by reorienting the next one onto the last pose shown.
  let pairs = 0;
  for (const a of graph.transitions) {
    if (a.to === null) continue;
    const end = a.block.poses.at(-1)!;
    for (const b of graph.transitions.filter((t) => t.from === a.to)) {
      assert.ok(isReoriented(b.block.poses[0], end), `line ${b.block.line} after line ${a.block.line}`);
      pairs++;
    }
  }
  assert.ok(pairs > 2000);
});
