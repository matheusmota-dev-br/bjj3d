import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ContactSolver } from "./contact.ts";
import { buildGraph, parse } from "./grapplemap.ts";
import { read, SIDED, submissionKind, type Kind, type Side } from "./metrics.ts";
import { landmarksFromPlayer } from "./landmarks.ts";

const graph = buildGraph(parse(readFileSync(new URL("../../data/grapplemap/GrappleMap.txt", import.meta.url), "utf8")));
const solver = new ContactSolver(JSON.parse(readFileSync(new URL("../../data/body/capsules.json", import.meta.url), "utf8")));

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
