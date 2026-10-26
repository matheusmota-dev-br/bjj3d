// The finishing moment: when a lock enters its danger range while playing, time slows, the
// camera pushes in on the joint, and it all happens once per playthrough.

import { afterEach, expect, test } from "vitest";
import { ARMBAR, clip, disposeViewers, inside, loadDb, makeViewer, run } from "./test/viewer-fixtures.ts";
import type { Frame } from "./viewer.ts";

afterEach(disposeViewers);

const DT = 1 / 30;
const starts = (frames: Frame[]) => frames.filter((f) => f.impactStart).length;

test("the finishing moment starts once, peaks, slows time and ends", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  const frames = run(v, 400, DT);
  expect(v.playing).toBe(false);
  expect(starts(frames)).toBe(1);
  const start = frames.findIndex((f) => f.impactStart);
  // It starts the frame after the lock first reads as dangerous.
  expect(frames[start - 1].reading!.danger).toBe(true);
  expect(frames.slice(0, start - 1).some((f) => f.reading!.danger)).toBe(false);
  expect(Math.max(...frames.map((f) => f.impact))).toBe(1);
  // At its peak time runs at 12% of the normal speed…
  const peak = frames.findIndex((f) => f.impact === 1);
  expect(frames[peak + 1].time - frames[peak].time).toBeCloseTo((DT / 0.8) * 0.12, 6);
  // …and when it is over, the lock is still on and time runs at the normal speed again. This
  // armbar reaches its last frame while the moment still plays, so the clock has stopped by then:
  // measure one step from a time the clip has not reached yet.
  const over = frames.findIndex((f, k) => k > peak && f.impact === 0);
  expect(frames[over].reading!.danger).toBe(true);
  v.time = v.last / 2;
  v.playing = true;
  const [next] = run(v, 1, DT);
  expect(next.impact).toBe(0);
  expect(next.time - v.last / 2).toBeCloseTo(DT / 0.8, 6);
});

test("at the finishing moment the directed camera pushes in on the joint", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  let peak: Frame | null = null;
  v.onFrame = (f) => { if (!peak && f.impact === 1) peak = f; };
  while (!peak) v.step(DT);
  const joint = inside(v).impact!.joint;
  expect(v.camera.position.distanceTo(joint)).toBeLessThan(inside(v).eased.position.distanceTo(joint) * 0.6);
  expect(v.controls.target.distanceTo(joint)).toBeLessThan(inside(v).eased.target.distanceTo(joint));
});

test("on a loop, every pass has its finishing moment", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.loop = true;
  // Two whole passes: play until the clock has wrapped around twice.
  const frames: Frame[] = [];
  v.onFrame = (f) => frames.push(f);
  let wraps = 0;
  while (wraps < 2) {
    const before = v.time;
    v.step(DT);
    if (v.time < before) wraps++;
  }
  expect(starts(frames)).toBe(2);
});

test("playing again from the start brings the moment back", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  run(v, 400, DT);
  v.time = 0;
  v.playing = true;
  expect(starts(run(v, 400, DT))).toBe(1);
});

test("no finishing moment when it is turned off or nothing plays", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.impactEffect = false;
  expect(starts(run(v, 400, DT))).toBe(0);
  v.impactEffect = true;
  v.playing = false;
  v.time = v.last;
  const frames = run(v, 5, DT);
  expect(frames[0].reading!.danger).toBe(true);
  expect(starts(frames)).toBe(0);
  expect(frames.every((f) => f.impact === 0)).toBe(true);
});
