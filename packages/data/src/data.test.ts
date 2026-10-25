import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { Db, parseRef, refKey, type GraphFile, type Ref } from "./data.ts";
import { basicallySame, mirror } from "@bjj3d/core";
import { encodePose } from "@bjj3d/grapplemap";
import { apart, overlapping } from "@bjj3d/core/testing";

const technique = {
  id: "demo", reviewed: false, names: { en: "Demo" },
  source: { grapplemap_line: 10, from: "standing", to: "mount" },
  steps: [{ frame: 0, text: { en: "Start" } }],
};

/** Two positions and three transitions: one both ways, one into nowhere, one from nowhere. */
function file(): GraphFile {
  const a = encodePose(apart()), b = encodePose(overlapping()), c = encodePose(mirror(apart()));
  return {
    substeps: 2,
    positions: [
      { name: "Standing apart", description: [], tags: ["standing"], refs: [], line: 1, pose: a },
      { name: "Mount", description: [], tags: ["mount", "top_kneeling"], refs: [], line: 6, pose: b },
    ],
    transitions: [
      { name: "close the distance", description: [], tags: [], properties: ["bidirectional", "top"], refs: [], line: 11, from: 0, to: 1, kind: null, poses: [a, c, b] },
      { name: "roll away", description: [], tags: ["escape"], properties: ["bottom"], refs: [], line: 20, from: 1, to: null, kind: null, poses: [b, a] },
      { name: "drop in", description: [], tags: [], properties: [], refs: [], line: 30, from: null, to: 0, kind: "elbow", poses: [c, a] },
    ],
    techniques: { 0: technique },
  };
}

afterEach(() => vi.restoreAllMocks());

test("refs print and parse back", () => {
  const refs: Ref[] = [{ type: "p", i: 3 }, { type: "t", i: 12, reversed: false }, { type: "t", i: 12, reversed: true }];
  assert.deepEqual(refs.map(refKey), ["p/3", "t/12", "t/12r"]);
  assert.deepEqual(refs.map((r) => parseRef(refKey(r))), refs);
  for (const bad of ["", "p/", "x/1", "p/1r2", "t/-1", "p/1 "]) assert.equal(parseRef(bad), null, bad);
});

test("each position knows the transitions that leave and reach it, both ways when bidirectional", () => {
  const db = new Db(file());
  assert.deepEqual(db.outgoing, [
    [{ type: "t", i: 0, reversed: false }],
    [{ type: "t", i: 0, reversed: true }, { type: "t", i: 1, reversed: false }],
  ]);
  assert.deepEqual(db.incoming, [
    [{ type: "t", i: 0, reversed: true }, { type: "t", i: 2, reversed: false }],
    [{ type: "t", i: 0, reversed: false }],
  ]);
});

test("poses are decoded once, and reversed for a transition played backwards", () => {
  const db = new Db(file());
  const p = db.poses({ type: "p", i: 1 });
  assert.equal(p.length, 1);
  assert.ok(basicallySame(p[0], overlapping(), 0.001));
  assert.equal(db.poses({ type: "p", i: 1 }), p);
  const fwd = db.poses({ type: "t", i: 0, reversed: false });
  const back = db.poses({ type: "t", i: 0, reversed: true });
  assert.equal(back.length, 3);
  assert.deepEqual(back, [...fwd].reverse());
  // Reversing makes a copy: the forward list is untouched.
  assert.ok(basicallySame(fwd[0], apart(), 0.001));
});

test("ends, names, techniques and who moves", () => {
  const db = new Db(file());
  assert.deepEqual(db.ends({ type: "p", i: 1 }), { from: 1, to: 1 });
  assert.deepEqual(db.ends({ type: "t", i: 0, reversed: false }), { from: 0, to: 1 });
  assert.deepEqual(db.ends({ type: "t", i: 0, reversed: true }), { from: 1, to: 0 });
  assert.equal(db.name({ type: "p", i: 0 }), "Standing apart");
  assert.equal(db.name({ type: "t", i: 1, reversed: false }), "roll away");
  assert.equal(db.technique({ type: "t", i: 0, reversed: false }), technique);
  assert.equal(db.technique({ type: "t", i: 0, reversed: true }), null);
  assert.equal(db.technique({ type: "t", i: 1, reversed: false }), null);
  assert.equal(db.technique({ type: "p", i: 0 }), null);
  assert.equal(db.mover({ type: "p", i: 0 }), null);
  assert.equal(db.mover({ type: "t", i: 0, reversed: false }), 0);
  assert.equal(db.mover({ type: "t", i: 1, reversed: false }), 1);
  assert.equal(db.mover({ type: "t", i: 2, reversed: false }), null);
});

test("search matches every word in names, tags (underscores as spaces) and a transition's ends", () => {
  const db = new Db(file());
  assert.deepEqual(db.search("MOUNT"), [{ type: "p", i: 1 }, { type: "t", i: 0, reversed: false }, { type: "t", i: 1, reversed: false }]);
  assert.deepEqual(db.search("top kneeling"), [{ type: "p", i: 1 }]);
  assert.deepEqual(db.search("roll  escape"), [{ type: "t", i: 1, reversed: false }]);
  assert.deepEqual(db.search("drop standing"), [{ type: "t", i: 2, reversed: false }]);
  assert.deepEqual(db.search("nothing like this"), []);
  // An empty query matches everything, up to the limit.
  assert.equal(db.search("").length, 5);
  assert.equal(db.search("", 2).length, 2);
});

test("load fetches graph.json by default, or the given url", async () => {
  const body = file();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(body)));
  const db = await Db.load();
  assert.equal(fetch.mock.calls[0][0], "graph.json");
  assert.equal(db.file.positions.length, 2);
  await Db.load("e2e/graph.json");
  assert.equal(fetch.mock.calls[1][0], "e2e/graph.json");
});
