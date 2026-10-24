// The viewer's clips: showing positions and transitions, playback, the attacked joint,
// chaining, mirroring and the editor's preview.

import * as THREE from "three";
import { afterEach, expect, test } from "vitest";
import { isReoriented, mirror } from "./grapplemap.ts";
import { AFTER_ARMBAR, ARMBAR, clip, disposeViewers, inside, loadDb, makeViewer, run } from "./test/viewer-fixtures.ts";

afterEach(disposeViewers);

test("a position shows still; playing it on a loop just holds it", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, { type: "p", i: 57 }));
  expect(v.playing).toBe(false);
  expect(v.last).toBe(0);
  v.loop = true;
  v.playing = true;
  const [f] = run(v, 1);
  expect(f).toMatchObject({ time: 0, last: 0, reading: null, joint: null, impact: 0 });
  expect(v.playing).toBe(false);
});

test("a transition plays at its speed and stops at the end, or loops", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  expect(v.playing).toBe(true);
  expect(v.last).toBe(8);
  v.impactEffect = false;
  v.speed = 0.5;
  run(v, 1, 0.08);
  expect(v.time).toBeCloseTo(0.05);
  v.speed = 1;
  run(v, 100, 0.1);
  expect(v.time).toBe(8);
  expect(v.playing).toBe(false);
  v.loop = true;
  v.playing = true;
  v.time = 7.99;
  run(v, 1, 0.1);
  expect(v.time).toBe(0);
  expect(v.playing).toBe(true);
});

test("hidden fighters are not drawn and do not glow", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.playing = false;
  v.time = 8;
  const player = inside(v).target!.player;
  v.visible = [player !== 0, player !== 1];
  const [f] = run(v, 1);
  expect(f.reading!.value).toBeGreaterThan(0.5);
  expect(inside(v).fighters[player].uniforms.tension.value).toBe(0);
  expect(inside(v).fighters[player].mannequin.group.visible).toBe(false);
  v.visible = [true, true];
  run(v, 1);
  expect(inside(v).fighters[player].uniforms.tension.value).toBeCloseTo(f.reading!.value);
});

test("the attacked joint is read and placed on the canvas", async () => {
  const db = await loadDb();
  const v = makeViewer(320, 180);
  v.show(clip(db, ARMBAR));
  v.playing = false;
  v.time = 8;
  const [f] = run(v, 1);
  expect(f.reading!.danger).toBe(true);
  expect(f.joint!.x).toBeGreaterThan(0);
  expect(f.joint!.x).toBeLessThan(320);
  expect(f.joint!.y).toBeGreaterThan(0);
  expect(f.joint!.y).toBeLessThan(180);
  expect(inside(v).target).toMatchObject({ kind: "elbow" });
});

test("a choke has no side: its single reading is taken", async () => {
  const db = await loadDb();
  const v = makeViewer();
  const choke = db.file.transitions.findIndex((t) => t.kind === "choke");
  v.show(clip(db, { type: "t", i: choke, reversed: false }));
  expect(inside(v).target).toMatchObject({ kind: "choke", side: "Left" });
  const [f] = run(v, 1);
  expect(f.reading).not.toBeNull();
});

test("a chained move starts where the last one ended and fades out the join", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.time = v.last;
  const end = v.currentPoses.at(-1)!;
  v.show(clip(db, AFTER_ARMBAR, true));
  expect(isReoriented(v.currentPoses[0], end, 0.1)).not.toBeNull();
  expect(inside(v).fadeFrom).not.toBeNull();
  // At the join the bodies are exactly where the last move left them…
  const at0 = inside(v).landmarksAt(0, 0);
  const endHead = new THREE.Vector3(...end[v.swapped ? 1 : 0].Head);
  expect(at0.Head.distanceTo(endHead)).toBeLessThan(1e-6);
  // …and half a keyframe later the fade is gone.
  const fresh = new THREE.Vector3(...v.currentPoses[2][0].Head);
  expect(inside(v).landmarksAt(1, 0).Head.distanceTo(fresh)).toBeLessThan(1e-6);
});

test("a chain that does not fit, or nothing before it, starts fresh", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, AFTER_ARMBAR, true));
  expect(inside(v).fadeFrom).toBeNull();
  v.show(clip(db, ARMBAR));
  v.time = 2;
  v.show(clip(db, AFTER_ARMBAR, true));
  expect(inside(v).fadeFrom).toBeNull();
  expect(v.swapped).toBe(false);
  expect(v.currentPoses).toBe(db.poses(AFTER_ARMBAR));
});

test("the opposite side mirrors what is shown and what comes next", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  const shown = v.currentPoses;
  v.setMirrored(false);
  expect(v.currentPoses).toBe(shown);
  v.setMirrored(true);
  expect(v.currentPoses[3]).toEqual(mirror(shown[3]));
  expect(inside(v).target).toMatchObject({ kind: "elbow" });
  v.show(clip(db, { type: "p", i: 57 }));
  expect(v.currentPoses[0]).toEqual(mirror(db.poses({ type: "p", i: 57 })[0]));
  v.setMirrored(false);
  expect(v.currentPoses[0]).toEqual(db.poses({ type: "p", i: 57 })[0]);
  expect(inside(v).target).toBeNull();
});

test("the editor's preview holds a frame without playing", async () => {
  const db = await loadDb();
  const v = makeViewer();
  const poses = db.poses(ARMBAR).filter((_, k) => k % 2 === 0);
  v.show(clip(db, ARMBAR));
  v.preview(poses, 99);
  expect(v.currentPoses).toBe(poses);
  expect(v.time).toBe(v.last);
  expect(v.last).toBe((poses.length - 1) / db.file.substeps);
  expect(v.playing).toBe(false);
  expect(inside(v).target).toBeNull();
});
