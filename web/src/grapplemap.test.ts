import { readFileSync } from "node:fs";
import { test } from "vitest";
import assert from "node:assert/strict";
import { basicallySame, buildGraph, decodePose, encodePose, formatBlock, isReoriented, JOINTS, mirror, parse, reorient } from "./grapplemap.ts";
import { apart, standing } from "./test/pose-fixtures.ts";

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

test("encoding and decoding a pose round-trips to the millimetre", () => {
  const p = apart();
  const q = decodePose(encodePose(p));
  for (const k of [0, 1] as const) for (const j of JOINTS) for (let c = 0; c < 3; c++) assert.ok(Math.abs(q[k][j][c] - p[k][j][c]) < 0.0006);
  // The database's own strings come back unchanged.
  for (const b of blocks.slice(0, 20)) for (const e of b.encoded) assert.equal(encodePose(decodePose(e)), e);
});

test("encoding clamps what the format cannot hold", () => {
  const far = apart();
  far[0].Head = [9, -1, -9];
  const q = decodePose(encodePose(far));
  assert.deepEqual(q[0].Head.map((x) => +x.toFixed(3)), [62 * 62 / 1000 - 0.001 - 2, 0, -2]);
});

test("decoding rejects a pose of the wrong length or with a foreign digit", () => {
  const e = encodePose(apart());
  assert.throws(() => decodePose(e.slice(2)), /expected 276/);
  assert.throws(() => decodePose("!" + e.slice(1)), /not a base-62 digit: !/);
  // Whitespace inside the string is ignored, as in the file's 4-line layout.
  assert.ok(basicallySame(decodePose(e.slice(0, 100) + "\n    " + e.slice(100)), apart(), 0.001));
});

test("a formatted block parses back to itself", () => {
  const block = { description: ["my move", "a second line"], tags: ["closed_guard", "armbar"], properties: ["top", "bidirectional"], refs: ["Someone https://example.com"], poses: [apart(), [standing(0.2), standing(-0.3)]] as ReturnType<typeof apart>[] };
  const text = formatBlock(block);
  // 4 lines of 69 characters per pose, as in GrappleMap.txt.
  assert.equal(text.split("\n").filter((l) => l.startsWith("    ")).length, 8);
  const [b] = parse(text);
  assert.equal(b.name, "my move");
  assert.deepEqual(b.description, block.description);
  assert.deepEqual(b.tags, block.tags);
  assert.deepEqual(b.properties, block.properties);
  assert.deepEqual(b.refs, block.refs);
  assert.equal(b.poses.length, 2);
  assert.ok(basicallySame(b.poses[1], block.poses[1], 0.001));
  assert.equal(b.line, 1);
});

test("a block without tags, properties or refs leaves those lines out", () => {
  const text = formatBlock({ description: ["bare"], tags: [], properties: [], refs: [], poses: [apart()] });
  assert.equal(text.split("\n")[1].startsWith("    "), true);
  const [b] = parse("\n\n" + text + "\n" + text);
  assert.deepEqual([b.tags, b.properties, b.refs, b.line], [[], [], [], 3]);
});

test("a block with no description is named by nothing, and \\n in a name becomes a space", () => {
  const poseLines = formatBlock({ description: [], tags: [], properties: [], refs: [], poses: [apart()] });
  assert.equal(parse(poseLines)[0].name, "");
  assert.equal(parse("two\\nlines\n" + poseLines)[0].name, "two lines");
});

test("a pose matches only itself within the tolerance", () => {
  const p = apart();
  const moved = reorient(p, { offset: [0.03, 0, 0], angle: 0, mirror: false, swapPlayers: false });
  assert.ok(basicallySame(p, moved));
  assert.equal(basicallySame(p, moved, 0.01), false);
});

test("poses whose heads are at different distances are never the same position", () => {
  assert.equal(isReoriented(apart(), [standing(-1), standing(1)]), null);
});

test("transitions whose ends match no position link to nothing", () => {
  const g = buildGraph(parse(formatBlock({ description: ["lonely"], tags: [], properties: [], refs: [], poses: [apart(), apart()] })));
  assert.deepEqual([g.positions.length, g.transitions[0].from, g.transitions[0].to], [0, null, null]);
});
