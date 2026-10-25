import { readFileSync } from "node:fs";
import { test } from "vitest";
import assert from "node:assert/strict";
import { ContactSolver } from "@bjj3d/core/contact";
import { buildGraph, parse } from "@bjj3d/grapplemap";
import { chokeGap, flexion, glowPoint, kneeTwist, read, shoulderRotation, SIDED, submissionKind, throat, type Kind, type Side } from "./metrics.ts";
import { standing, withJoints } from "@bjj3d/core/testing";
import { landmarksFromPlayer } from "./landmarks.ts";

const graph = buildGraph(parse(readFileSync(new URL("../../../data/grapplemap/GrappleMap.txt", import.meta.url), "utf8")));
const solver = new ContactSolver(JSON.parse(readFileSync(new URL("../../../data/body/capsules.json", import.meta.url), "utf8")));

function transition(line: number) {
  const t = graph.transitions.find((x) => x.block.line === line);
  assert.ok(t, `no transition at line ${line}`);
  return t;
}

/** Did any player and side reach the danger range of this kind, as the viewer shows it? */
function reachesDanger(line: number, kind: Kind) {
  const frames = solver.transition(transition(line).block.poses).map((p) => p.map(landmarksFromPlayer));
  return frames.some((f) => [0, 1].some((p) =>
    ((SIDED[kind] ? ["Left", "Right"] : ["Left"]) as Side[]).some((s) => read(kind, f[p], f[1 - p], s).danger)));
}

test("the knee-on-belly armbar reaches the elbow's danger range", () => {
  assert.ok(reachesDanger(14237, "elbow"));
});

test("the closed-guard armbar setup does not", () => {
  assert.equal(reachesDanger(5658, "elbow"), false);
});

test("finishes of other kinds reach theirs", () => {
  assert.ok(reachesDanger(31966, "shoulder")); // full guard kimura, tap
  assert.ok(reachesDanger(32448, "kneeTwist")); // honey hole heel hook, tap
  assert.ok(reachesDanger(31530, "choke")); // seated rear naked choke, tap
});

test("a transition takes its kind from its tags or from the positions it joins", () => {
  const t = transition(31966);
  assert.equal(submissionKind(t.block.tags, graph.positions[t.from!].tags), "shoulder");
  assert.equal(submissionKind(["half_guard"], ["mount"]), null);
});

// --- the same metrics on hand-built bodies, where the expected numbers are known

const L = (p = standing()) => landmarksFromPlayer(p);
const far = L(standing(3));

test("flexion is 0 for a straight limb and 90 for a right angle", () => {
  const a = L().LeftHip.clone().set(0, 0, 0), b = a.clone().set(0, 1, 0);
  assert.equal(Math.round(flexion(a, b, b.clone().set(0, 2, 0))), 0);
  assert.equal(Math.round(flexion(a, b, b.clone().set(1, 1, 0))), 90);
});

test("a straight leg is in the knee's danger range only with the opponent's hips on the knee", () => {
  const target = L();
  const k = target.LeftKnee;
  const hipsOnKnee = L(withJoints(standing(3), {
    LeftHip: [k.x + 0.1, k.y + 0.05, k.z], RightHip: [k.x - 0.1, k.y + 0.05, k.z],
    LeftKnee: [k.x + 0.1, k.y + 0.05, k.z + 0.4], RightKnee: [k.x - 0.1, k.y + 0.05, k.z + 0.4],
  }));
  const on = read("knee", target, hipsOnKnee, "Left");
  assert.ok(on.measure < 10 && on.danger && on.value > 0.5);
  const off = read("knee", target, far, "Left");
  assert.deepEqual([off.danger, off.value], [false, 0]);
});

test("the side defaults to the left", () => {
  const target = L(withJoints(standing(), { RightElbow: [-0.6, 1.4, 0], RightWrist: [-0.9, 1.4, 0] }));
  assert.deepEqual(read("elbow", target, far), read("elbow", target, far, "Left"));
  assert.notDeepEqual(read("elbow", target, far, "Right").measure, read("elbow", target, far).measure);
});

test("a head bent far forward is a neck crank; an upright one is not", () => {
  assert.deepEqual(read("neckCrank", L(), far), { value: 0, danger: false, measure: 0 });
  const bent = read("neckCrank", L(withJoints(standing(), { Head: [0, 1.5, 0.2] })), far);
  assert.ok(bent.measure > 75 && bent.danger && bent.value > 0.8);
});

test("hanging arms and straight legs give no confident rotation", () => {
  const l = L();
  assert.equal(shoulderRotation(l, "Left").confidence, 0);
  assert.equal(kneeTwist(l, "Right").confidence, 0);
});

test("a choke needs two of the opponent's limbs at the throat", () => {
  const target = L();
  const t = throat(target);
  // One forearm across the throat is not enough: the second-closest limb is far.
  const oneArm = L(withJoints(standing(3), { LeftElbow: [t.x + 0.6, t.y, t.z + 0.1], LeftWrist: [t.x - 0.2, t.y, t.z + 0.1] }));
  assert.ok(chokeGap(target, oneArm) > 0.4);
  const twoArms = L(withJoints(standing(3), {
    LeftShoulder: [t.x - 0.2, t.y, t.z - 0.1], LeftElbow: [t.x + 0.05, t.y, t.z - 0.1],
    LeftWrist: [t.x - 0.2, t.y, t.z + 0.1],
  }));
  const r = read("choke", target, twoArms);
  assert.ok(r.measure < 0.12 && r.danger && r.value > 0.5);
});

test("the glow sits on the attacked joint, between knee and ankle for a twist, at the throat for the neck", () => {
  const l = L();
  assert.equal(glowPoint("elbow", l, "Left"), l.LeftElbow);
  assert.equal(glowPoint("shoulder", l, "Right"), l.RightShoulder);
  assert.equal(glowPoint("knee", l, "Left"), l.LeftKnee);
  assert.ok(glowPoint("kneeTwist", l, "Left").equals(l.LeftKnee.clone().lerp(l.LeftAnkle, 0.3)));
  assert.ok(glowPoint("choke", l, "Left").equals(throat(l)));
  assert.ok(glowPoint("neckCrank", l, "Right").equals(throat(l)));
  // Unsided kinds read the same either way.
  for (const k of Object.keys(SIDED) as Kind[]) if (!SIDED[k]) assert.deepEqual(read(k, l, far, "Left"), read(k, l, far, "Right"));
});
