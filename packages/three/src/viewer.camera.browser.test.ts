// The viewer's cameras: directed (per keyframe, gliding, orbiting), free, side, top and
// through either fighter's eyes.

import * as THREE from "three";
import { afterEach, expect, test } from "vitest";
import { ARMBAR, clip, disposeViewers, inside, loadDb, makeViewer, run } from "./test/viewer-fixtures.ts";

afterEach(disposeViewers);

const STANDING = { type: "p", i: 94 } as const;

test("with nothing shown, no camera moves", () => {
  const v = makeViewer();
  const before = v.camera.position.clone();
  v.setCamera("side");
  v.setCamera("free");
  expect(v.camera.position).toEqual(before);
});

test("the free camera frames the bodies, except when it takes over from the directed one", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.playing = false;
  run(v, 1);
  const directed = v.camera.position.clone();
  v.setCamera("free");
  expect(v.controls.enabled).toBe(true);
  expect(v.camera.position).toEqual(directed);
  v.setCamera("side");
  v.setCamera("free");
  const focus = inside(v).focus;
  const dir = v.camera.position.clone().sub(focus).normalize();
  expect(dir.distanceTo(new THREE.Vector3(Math.SQRT1_2, 0.55, Math.SQRT1_2).normalize())).toBeLessThan(1e-6);
  expect(v.controls.target).toEqual(focus);
  // The orbit center drifts toward the bodies a little every frame.
  v.controls.target.set(0, 0, 5);
  run(v, 1);
  expect(v.controls.target.z).toBeCloseTo(5 + (focus.z - 5) * 0.05, 5);
});

test("the side and top cameras look at the pair from the side and from above", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.playing = false;
  v.setCamera("side");
  run(v, 1);
  const c = inside(v).landmarksAt(0, 0).MidHip.clone().add(inside(v).landmarksAt(0, 1).MidHip).multiplyScalar(0.5);
  expect(v.camera.position.x).toBeCloseTo(c.x);
  expect(v.camera.position.z).toBeGreaterThan(c.z + 1);
  expect(v.camera.fov).toBe(40);
  v.setCamera("top");
  run(v, 1);
  expect(v.camera.position.x).toBeCloseTo(c.x);
  expect(v.camera.position.z).toBeCloseTo(c.z + 0.01);
  expect(v.camera.position.y).toBeGreaterThan(2);
});

test("through a fighter's eyes, with a wide lens and their own body faint", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.playing = false;
  for (const p of [0, 1]) {
    v.setCamera(p === 0 ? "eyes0" : "eyes1");
    run(v, 1);
    const head = inside(v).landmarksAt(0, p).Head;
    expect(v.camera.fov).toBe(80);
    expect(v.camera.position.distanceTo(head)).toBeCloseTo(0.13);
    expect(inside(v).fighters[p].uniforms.intensity.value).toBe(0.12);
    expect(inside(v).fighters[1 - p].uniforms.intensity.value).toBe(1);
  }
});

test("the directed camera jumps on a new clip, then glides from keyframe to keyframe", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.playing = false;
  run(v, 1);
  const first = inside(v).goal.position.clone();
  expect(v.camera.position.distanceTo(first)).toBeLessThan(1e-9);
  v.time = 6;
  run(v, 1);
  const next = inside(v).goal.position.clone();
  expect(next.distanceTo(first)).toBeGreaterThan(0.01);
  // One frame later the camera is on its way, not there yet.
  expect(v.camera.position.distanceTo(next)).toBeGreaterThan(1e-3);
  expect(v.camera.position.distanceTo(next)).toBeLessThan(first.distanceTo(next));
  // Within the same keyframe the goal stays.
  run(v, 1);
  expect(inside(v).goal.position).toEqual(next);
});

test("while playing, the directed camera orbits slowly", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.impactEffect = false;
  run(v, 1, 0.05);
  const azimuth = inside(v).azimuth;
  run(v, 1, 0.05);
  expect(inside(v).azimuth - azimuth).toBeCloseTo(0.05 * 0.05);
});

test("the directed camera keeps the attacked joint in sight at every keyframe", async () => {
  const db = await loadDb();
  const v = makeViewer(320, 180);
  v.show(clip(db, ARMBAR));
  v.playing = false;
  for (let k = 0; k <= v.last; k++) {
    v.time = k;
    v.setCamera("directed"); // jump straight to the keyframe's goal
    v.setCamera("side");
    v.setCamera("directed");
    const [f] = run(v, 1);
    expect(f.joint!.x).toBeGreaterThan(0);
    expect(f.joint!.x).toBeLessThan(320);
    expect(f.joint!.y).toBeGreaterThan(0);
    expect(f.joint!.y).toBeLessThan(180);
  }
});

test("the directed camera prefers to stay near its last angle", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, { type: "p", i: 57 }));
  const l = [0, 1].map((p) => inside(v).landmarksAt(0, p));
  const goal = (v as unknown as { directedGoal(l: unknown, c: boolean): unknown }).directedGoal.bind(v);
  const angle = (from: number, continuity: boolean) => { inside(v).azimuth = from; goal(l, continuity); return inside(v).azimuth; };
  const gap = (a: number, b: number) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const free = angle(0, false);
  expect(angle(Math.PI, false)).toBe(free);
  // Starting from the side the free choice is not on, continuity pulls the camera closer.
  const start = free + Math.PI;
  expect(gap(angle(start, true), start)).toBeLessThan(gap(free, start));
});

test("the directed camera takes over smoothly from the free one, and jumps from the others", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, { type: "p", i: STANDING.i }));
  v.setCamera("free");
  v.camera.position.set(4, 3, 4);
  v.setCamera("directed");
  run(v, 1);
  expect(v.camera.position.distanceTo(inside(v).goal.position)).toBeGreaterThan(1e-3);
  v.setCamera("top");
  run(v, 1);
  v.setCamera("directed");
  run(v, 1);
  expect(v.camera.position.distanceTo(inside(v).goal.position)).toBeLessThan(1e-9);
  expect(v.controls.enabled).toBe(false);
});
