// The viewer's scene: the animation loop, grabbing, resizing, sticks, styles, places, looks.

import * as THREE from "three";
import { afterEach, expect, test, vi } from "vitest";
import { ARMBAR, clip, disposeViewers, inside, loadDb, makeViewer, run } from "./test/viewer-fixtures.ts";
import { Viewer } from "./viewer.ts";
import { builtinPlaces } from "./environment.ts";
import { builtinLooks } from "./materials.ts";
import { BELT_COLORS } from "./mannequin.ts";

afterEach(disposeViewers);

test("the animation loop draws frames on its own", async () => {
  const db = await loadDb();
  const v = makeViewer(160, 90, true);
  v.show(clip(db, ARMBAR));
  const frame = await new Promise((resolve) => (v.onFrame = resolve));
  expect(frame).toMatchObject({ last: 8 });
});

test("a viewer with nothing to show draws nothing", () => {
  const v = makeViewer();
  const onFrame = vi.fn();
  v.onFrame = onFrame;
  v.step(0.016);
  expect(onFrame).not.toHaveBeenCalled();
});

test("grabbing the view hands the camera over only while it is directed and not customizing", () => {
  const v = makeViewer();
  const onGrab = vi.fn();
  v.onGrab = onGrab;
  // The orbit controls would try to capture these synthetic pointers.
  v.controls.enabled = false;
  v.canvas.dispatchEvent(new PointerEvent("pointerdown"));
  expect(onGrab).toHaveBeenCalledTimes(1);
  v.setCamera("free");
  v.controls.enabled = false;
  v.canvas.dispatchEvent(new PointerEvent("pointerdown"));
  v.setCamera("directed");
  v.studio = 0;
  v.canvas.dispatchEvent(new PointerEvent("pointerdown"));
  expect(onGrab).toHaveBeenCalledTimes(1);
});

test("a window resize follows the canvas size", () => {
  const v = makeViewer(320, 180);
  v.canvas.style.width = "360px";
  dispatchEvent(new Event("resize"));
  expect(v.camera.aspect).toBeCloseTo(2);
});

test("sticks are made once, drawn over the bodies and can be hidden", async () => {
  const db = await loadDb();
  const v = makeViewer();
  const children = v.scene.children.length;
  v.showSticks(false);
  expect(v.scene.children.length).toBe(children);
  v.showSticks(true);
  const sticks = inside(v).sticks!;
  expect(sticks).toBeInstanceOf(THREE.LineSegments);
  v.showSticks(true);
  expect(inside(v).sticks).toBe(sticks);
  v.show(clip(db, ARMBAR));
  run(v, 1);
  const position = sticks.geometry.getAttribute("position");
  expect(Math.abs(position.getY(0))).toBeGreaterThan(0.05);
  v.showSticks(false);
  expect(sticks.visible).toBe(false);
});

test("a new belt repaints a fighter; the same belt keeps the paint", () => {
  const v = makeViewer();
  const before = inside(v).fighters[0].paints.solid;
  v.setStyle(0, { build: 1.1, belt: "white" });
  expect(inside(v).fighters[0].paints.solid).toBe(before);
  expect(inside(v).fighters[0].mannequin.build).toBe(1.1);
  v.setStyle(0, { build: 1, belt: "black" });
  expect(inside(v).fighters[0].paints.solid).not.toBe(before);
});

test("a new place replaces the old one, frees it, and repaints the x-ray look", () => {
  const v = makeViewer();
  v.setEnvironment("mat", "light");
  const first = v.scene.children.at(-1)!;
  expect(v.controls.maxDistance).toBe(12);
  expect(inside(v).fighters[0].uniforms.onLight.value).toBe(1);
  v.setLook("hologram");
  const hologram = inside(v).fighters[0].paints.hologram;
  const groups = v.scene.children.length;
  v.setEnvironment("gym", "dark");
  expect(v.scene.children.length).toBe(groups);
  expect(v.controls.maxDistance).toBe(5.2);
  expect(inside(v).fighters[0].paints.hologram).not.toBe(hologram);
  expect(v.scene.children).not.toContain(first);
  v.setEnvironment("night", "dark");
  expect(inside(v).fighters[0].uniforms.onLight.value).toBe(0);
  expect(v.scene.fog).toBeNull();
});

test("a look is built once per fighter and reused", () => {
  const v = makeViewer();
  v.setLook("wood");
  const wood = inside(v).fighters[1].paints.wood;
  v.setLook("solid");
  v.setLook("wood");
  expect(inside(v).fighters[1].paints.wood).toBe(wood);
  expect(v.look).toBe("wood");
});

test("an unknown place, look or belt falls back to the default; a look may leave out shadows", async () => {
  const db = await loadDb();
  const paint = vi.fn(builtinLooks[0].paint);
  // A canvas of its own, for a viewer with an added look; dispose loses its context, which would
  // stall the fixture's shared canvas.
  const canvas = document.body.appendChild(document.createElement("canvas"));
  canvas.style.cssText = "width:32px;height:18px;display:block";
  const v = new Viewer(canvas, { looks: [{ id: "plain", paint }] });
  v.renderer.setAnimationLoop(null);
  v.show(clip(db, ARMBAR));
  v.setEnvironment("on the moon", "light");
  expect(v.controls.maxDistance).toBe(builtinPlaces.find((d) => d.id === "mat")!.build("light").maxDistance);
  v.setLook("velvet");
  expect(inside(v).fighters[0].paints.velvet).toBeDefined();
  v.setStyle(0, { build: 0.5, belt: "rainbow" });
  v.setLook("plain");
  expect(paint).toHaveBeenCalledWith(expect.anything(), expect.anything(), BELT_COLORS.white, expect.any(Boolean));
  for (const m of inside(v).fighters[0].mannequin.group.children) expect(m.castShadow).toBe(true);
  v.dispose();
  canvas.remove();
});

test("dispose releases the viewer: the loop, the controls, the textures and the WebGL context", async () => {
  // A canvas of its own: losing the context of the fixture's shared one would stall the other tests.
  const canvas = document.body.appendChild(document.createElement("canvas"));
  canvas.style.cssText = "width:32px;height:18px;display:block";
  const v = new Viewer(canvas);
  v.show(clip(await loadDb(), ARMBAR));
  const background = new THREE.Texture();
  const map = new THREE.Texture();
  v.scene.background = background;
  v.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ map })));
  const disposed = [vi.spyOn(background, "dispose"), vi.spyOn(map, "dispose")];
  const loop = vi.spyOn(v.renderer, "setAnimationLoop");
  const controls = vi.spyOn(v.controls, "dispose");
  v.dispose();
  expect(loop).toHaveBeenCalledWith(null);
  expect(controls).toHaveBeenCalledOnce();
  for (const d of disposed) expect(d).toHaveBeenCalled();
  expect(v.renderer.getContext().isContextLost()).toBe(true);
  canvas.remove();
});
