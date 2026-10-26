// Shared by the viewer's browser tests: the real database, a viewer on a small canvas with
// its animation loop stopped (the tests drive it with step), and access to its internals.

import * as THREE from "three";
import { Db, type Ref } from "@bjj3d/data";
import type { Landmarks } from "@bjj3d/metrics";
import type { SharedUniforms } from "../materials.ts";
import type { Mannequin, Paint } from "../mannequin.ts";
import { Viewer, type Clip, type Frame } from "../viewer.ts";

let loading: Promise<Db> | null = null;
export const loadDb = () => (loading ??= Db.load("/graph.json"));

/** Transition 458: the knee-on-belly armbar, an elbow lock; 1207 continues from its end. */
export const ARMBAR: Ref = { type: "t", i: 458, reversed: false };
export const AFTER_ARMBAR: Ref = { type: "t", i: 1207, reversed: false };

export function clip(db: Db, r: Ref, chain = false): Clip {
  return { poses: db.poses(r), substeps: r.type === "t" ? db.file.substeps : 1, kind: r.type === "t" ? db.file.transitions[r.i].kind : null, chain };
}

const made: Viewer[] = [];
let canvas: HTMLCanvasElement | null = null;

/**
 * A viewer on the file's one canvas (so one WebGL context: software WebGL stalls for minutes
 * when contexts pile up or are forced lost); the animation loop is stopped unless asked for.
 */
export function makeViewer(width = 160, height = 90, loop = false): Viewer {
  canvas ??= document.body.appendChild(document.createElement("canvas"));
  canvas.style.cssText = `width:${width}px;height:${height}px;display:block`;
  const v = new Viewer(canvas);
  if (!loop) v.renderer.setAnimationLoop(null);
  // Software WebGL spends most of a frame on the 2048² shadow map; nothing the tests check
  // depends on shadows.
  v.renderer.shadowMap.enabled = false;
  // Draw off screen: in software WebGL every frame presented on the page's canvas costs tens of
  // milliseconds, paid after the test, and a test steps hundreds of frames. The tests read the
  // viewer's state, not its pixels (thumbnails() draws to targets of its own).
  v.renderer.setRenderTarget(new THREE.WebGLRenderTarget(width, height));
  made.push(v);
  return v;
}

/** Stops every viewer made so far and frees what it uploaded; the canvas stays. */
export function disposeViewers() {
  for (const v of made.splice(0)) {
    v.renderer.setAnimationLoop(null);
    v.controls.dispose();
    v.renderer.dispose();
  }
}

/** Steps the viewer n times by dt and returns every frame it reported. */
export function run(v: Viewer, n: number, dt = 1 / 30): Frame[] {
  const frames: Frame[] = [];
  const before = v.onFrame;
  v.onFrame = (f) => { frames.push(f); before(f); };
  for (let k = 0; k < n; k++) v.step(dt);
  v.onFrame = before;
  return frames;
}

/** The parts of the viewer the tests look inside. */
export interface Inside {
  fighters: { mannequin: Mannequin; uniforms: SharedUniforms; paints: Record<string, Paint | undefined> }[];
  goal: { position: THREE.Vector3; target: THREE.Vector3 };
  eased: { position: THREE.Vector3; target: THREE.Vector3 };
  azimuth: number;
  target: { player: number; side: string; kind: string } | null;
  impact: { t: number; joint: THREE.Vector3 } | null;
  fadeFrom: unknown;
  sticks: THREE.LineSegments | null;
  camAnim: unknown;
  studioLandmarks: Landmarks | null;
  focus: THREE.Vector3;
  landmarksAt(keyTime: number, player: number): Landmarks;
}
export const inside = (v: Viewer) => v as unknown as Inside;
