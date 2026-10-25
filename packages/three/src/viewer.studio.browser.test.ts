// The customizing screen (one fighter standing, the camera gliding between body and belt),
// the view shift under a drawer, and the offscreen images: thumbnails and snapshots.

import { afterEach, expect, test } from "vitest";
import { ARMBAR, clip, disposeViewers, inside, loadDb, makeViewer, run } from "./test/viewer-fixtures.ts";

afterEach(disposeViewers);

const STANDING = { type: "p", i: 94 } as const;

/** Width and height of a JPEG data URL, once decoded. */
async function size(url: string) {
  expect(url.startsWith("data:image/jpeg;base64,")).toBe(true);
  const img = new Image();
  img.src = url;
  await img.decode();
  return [img.naturalWidth, img.naturalHeight];
}

test("customizing shows one fighter alone, standing at the center and facing the camera", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.showSticks(true);
  v.studioPose = db.poses(STANDING)[0];
  v.setStudio(1);
  expect(v.studio).toBe(1);
  expect(v.controls.enabled).toBe(true);
  const l = inside(v).studioLandmarks!;
  expect(Math.hypot(l.MidHip.x, l.MidHip.z)).toBeLessThan(1e-6);
  // Facing +z: the nose side of the chest is toward the camera.
  expect(v.camera.position.z).toBeGreaterThan(1);
  run(v, 1);
  expect(inside(v).fighters[1].mannequin.group.visible).toBe(true);
  expect(inside(v).fighters[0].mannequin.group.visible).toBe(false);
  expect(inside(v).sticks!.visible).toBe(false);
  // Grabbing the view here is just orbiting.
  let grabbed = false;
  v.onGrab = () => (grabbed = true);
  v.controls.enabled = false;
  v.canvas.dispatchEvent(new PointerEvent("pointerdown"));
  expect(grabbed).toBe(false);
});

test("the camera glides to the belt and back to the body", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.studioPose = db.poses(STANDING)[0];
  v.setStudio(0);
  const body = v.controls.target.clone();
  v.focusStudio("belt");
  v.focusStudio("belt"); // already going there
  run(v, 1, 0.35);
  expect(inside(v).camAnim).not.toBeNull();
  const halfway = v.controls.target.clone();
  run(v, 1, 0.35);
  expect(inside(v).camAnim).toBeNull();
  const l = inside(v).studioLandmarks!;
  expect(v.controls.target.distanceTo(l.MidHip.clone().lerp(l.Core, 0.3))).toBeLessThan(1e-6);
  expect(halfway.distanceTo(body)).toBeGreaterThan(0);
  expect(halfway.distanceTo(v.controls.target)).toBeGreaterThan(0);
  v.focusStudio("body");
  run(v, 3, 0.35);
  expect(v.controls.target.distanceTo(body)).toBeLessThan(1e-6);
});

test("leaving the customizing screen restores the view; without a pose there is none", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.setStudio(0);
  expect(v.studio).toBeNull();
  v.studioPose = db.poses(STANDING)[0];
  v.setStudio(0);
  v.focusStudio("belt");
  v.setStudio(null);
  expect(v.studio).toBeNull();
  expect(inside(v).camAnim).toBeNull();
  expect(v.controls.enabled).toBe(false);
  // Focusing while not customizing does nothing.
  const before = v.controls.target.clone();
  v.focusStudio("body");
  expect(v.controls.target).toEqual(before);
});

test("a studio without a standing pose yet shows its fighter unposed and does not move", () => {
  const v = makeViewer();
  v.studio = 0;
  v.focusStudio("body");
  expect(inside(v).camAnim).toBeNull();
  run(v, 1);
  expect(inside(v).fighters[0].mannequin.group.visible).toBe(true);
  expect(inside(v).fighters[1].mannequin.group.visible).toBe(false);
});

test("a drawer over the view shifts the scene sideways, mirrored in right-to-left pages", () => {
  const v = makeViewer();
  v.setViewShift(100);
  expect(v.camera.view).toMatchObject({ enabled: true, offsetX: -100 });
  document.documentElement.dir = "rtl";
  v.setViewShift(100);
  expect(v.camera.view).toMatchObject({ enabled: true, offsetX: 100 });
  document.documentElement.dir = "";
  v.setViewShift(0);
  expect(v.camera.view?.enabled ?? false).toBe(false);
});

test("thumbnails are real frames, and the live view is left as it was", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, ARMBAR));
  v.showSticks(true);
  run(v, 1);
  const before = { azimuth: inside(v).azimuth, target: inside(v).target, aspect: v.camera.aspect };
  const images = v.thumbnails([0, 4, 8]);
  expect(images).toHaveLength(3);
  expect(await size(images[0])).toEqual([640, 360]);
  expect(new Set(images).size).toBe(3);
  expect({ azimuth: inside(v).azimuth, target: inside(v).target, aspect: v.camera.aspect }).toEqual(before);
  expect(inside(v).sticks!.visible).toBe(true);
  v.showSticks(false);
  v.thumbnails([0], 64, 36);
  expect(inside(v).sticks!.visible).toBe(false);
});

test("a position's thumbnail is its one frame", async () => {
  const db = await loadDb();
  const v = makeViewer();
  v.show(clip(db, STANDING));
  const [a] = v.thumbnails([0], 64, 36);
  const [b] = v.thumbnails([0.5], 64, 36);
  expect(await size(a)).toEqual([64, 36]);
  expect(b).toBe(a);
});

test("snapshots show any pose, lit on the attacked joint when there is one", async () => {
  const db = await loadDb();
  const v = makeViewer();
  const end = db.poses(ARMBAR).at(-1)!;
  const plain = v.snapshot(end, null);
  expect(await size(plain)).toEqual([352, 198]);
  const lit = v.snapshot(end, "elbow");
  expect(lit).not.toBe(plain);
  const choke = db.file.transitions.findIndex((t) => t.kind === "choke");
  expect(await size(v.snapshot(db.poses({ type: "t", i: choke, reversed: false }).at(-1)!, "choke", 96, 54))).toEqual([96, 54]);
});
