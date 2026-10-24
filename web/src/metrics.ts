// Joint load from geometry alone. GrappleMap has no forces or timing, so the "tension"
// of a submission is how far the attacked joint is pushed through its range, gated by
// something of the opponent being where the leverage comes from. Each submission kind
// has one metric; the viewer lights only the joint that the technique attacks.
//
// Thresholds are calibrated with `npm run validate` over the whole database; see
// docs/validation.md for the numbers they produce.

import * as THREE from "three";
import type { Joint } from "./grapplemap.ts";
import type { Landmarks } from "./landmarks.ts";

export type Side = "Left" | "Right";
export type Kind = "elbow" | "shoulder" | "knee" | "kneeTwist" | "choke" | "neckCrank";

/** GrappleMap tags that name a submission, and the joint each one attacks. */
export const KIND_BY_TAG: Record<string, Kind> = {
  armbar: "elbow",
  kimura: "shoulder",
  omoplata: "shoulder",
  monoplata: "shoulder",
  shoulder_lock: "shoulder",
  knee_bar: "knee",
  heel_hook: "kneeTwist",
  toehold: "kneeTwist",
  rear_naked_choke: "choke",
  guillotine: "choke",
  darce: "choke",
  triangle: "choke",
  arm_triangle: "choke",
  arm_choke: "choke",
  neck_crank: "neckCrank",
};

export const SIDED: Record<Kind, boolean> = {
  elbow: true, shoulder: true, knee: true, kneeTwist: true, choke: false, neckCrank: false,
};

export interface Reading {
  /** 0..1, what the viewer paints. */
  value: number;
  /** In the range where the lock or choke can hurt. */
  danger: boolean;
  /** The measured angle (degrees) or distance (metres) behind the value. */
  measure: number;
}

const v = () => new THREE.Vector3();
const sub = (a: THREE.Vector3, b: THREE.Vector3) => v().subVectors(a, b);
const deg = THREE.MathUtils.radToDeg;
const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);
const near = (d: number, close: number, far: number) => 1 - THREE.MathUtils.smoothstep(d, close, far);

function segmentDistance(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  return new THREE.Line3(a, b).closestPointToPoint(p, true, v()).distanceTo(p);
}

/** Closest distance from a point to the opponent's hips and thighs. */
function hipsDistance(p: THREE.Vector3, o: Landmarks) {
  return Math.min(
    segmentDistance(p, o.LeftHip, o.LeftKnee),
    segmentDistance(p, o.RightHip, o.RightKnee),
    segmentDistance(p, o.LeftHip, o.RightHip),
  );
}

/** Hinge flexion in degrees: 0 is a straight limb. */
export function flexion(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  return deg(sub(b, a).angleTo(sub(c, b)));
}

/**
 * Hyperextension locks: straight limb with the opponent's hips on the joint.
 * GrappleMap draws armbars down to 4-11° of flexion and its knee bar at 21°; with the
 * bodies at full thickness the arm comes off the hips a little, so the elbow's limit is 14°.
 */
function extension(f: number, lever: number, start: number, danger: number): Reading {
  const range = clamp01((start - f) / start);
  const leverage = near(lever, 0.18, 0.45);
  return { value: range * leverage, danger: f < danger && leverage > 0.5, measure: f };
}

/**
 * Rotation of the upper arm about its own axis, in degrees: positive is internal
 * (the hand travels behind the back, as in a kimura). Measured by swinging the torso's
 * forward direction along with the arm and comparing it with the forearm.
 */
export function shoulderRotation(l: Landmarks, s: Side): { angle: number; confidence: number } {
  const up = sub(l.Neck, l.Core).normalize();
  const lat = sub(l.RightShoulder, l.LeftShoulder);
  lat.addScaledVector(up, -lat.dot(up)).normalize();
  const fwd = v().crossVectors(up, lat);
  const upper = sub(l[`${s}Elbow`], l[`${s}Shoulder`]).normalize();
  const fore = sub(l[`${s}Wrist`], l[`${s}Elbow`]);
  const swing = new THREE.Quaternion().setFromUnitVectors(up.clone().negate(), upper);
  const ref = fwd.applyQuaternion(swing);
  const project = (x: THREE.Vector3) => x.clone().addScaledVector(upper, -x.dot(upper)).normalize();
  const a = project(ref), b = project(fore);
  const angle = deg(Math.atan2(v().crossVectors(a, b).dot(upper), a.dot(b)));
  // The forearm only shows the rotation when the elbow is bent; overhead the swing flips.
  const bend = flexion(l[`${s}Shoulder`], l[`${s}Elbow`], l[`${s}Wrist`]);
  const confidence = clamp01((bend - 30) / 30) * clamp01((upper.dot(up) - 0.9) / -0.4);
  return { angle: s === "Right" ? -angle : angle, confidence };
}

/** Rotation of the shin under a bent knee, in degrees, either way. */
export function kneeTwist(l: Landmarks, s: Side): { angle: number; confidence: number } {
  const thigh = sub(l[`${s}Knee`], l[`${s}Hip`]);
  const shin = sub(l[`${s}Ankle`], l[`${s}Knee`]).normalize();
  const project = (x: THREE.Vector3) => x.clone().addScaledVector(shin, -x.dot(shin)).normalize();
  // With the knee bent, a neutral foot points where the thigh points.
  const neutral = project(thigh), foot = project(sub(l[`${s}Toe`], l[`${s}Heel`]));
  const bend = flexion(l[`${s}Hip`], l[`${s}Knee`], l[`${s}Ankle`]);
  return { angle: deg(neutral.angleTo(foot)), confidence: clamp01((bend - 30) / 30) };
}

const LIMB_SEGMENTS: [Joint, Joint][] = [
  ["LeftShoulder", "LeftElbow"], ["LeftElbow", "LeftWrist"], ["RightShoulder", "RightElbow"], ["RightElbow", "RightWrist"],
  ["LeftHip", "LeftKnee"], ["LeftKnee", "LeftAnkle"], ["RightHip", "RightKnee"], ["RightKnee", "RightAnkle"],
];

/** Throat point: a little above the base of the neck. */
export const throat = (l: Landmarks) => l.Neck.clone().lerp(l.Head, 0.35);

/**
 * Distance from the throat to the opponent's second-closest limb segment: a choke
 * needs the neck held from two sides (forearm and biceps, or thigh and shin).
 */
export function chokeGap(target: Landmarks, opponent: Landmarks): number {
  const t = throat(target);
  const d = LIMB_SEGMENTS.map(([a, b]) => segmentDistance(t, opponent[a], opponent[b])).sort((x, y) => x - y);
  return d[1];
}

export function read(kind: Kind, target: Landmarks, opponent: Landmarks, s: Side = "Left"): Reading {
  switch (kind) {
    case "elbow":
      return extension(flexion(target[`${s}Shoulder`], target[`${s}Elbow`], target[`${s}Wrist`]), hipsDistance(target[`${s}Elbow`], opponent), 40, 14);
    case "knee":
      return extension(flexion(target[`${s}Hip`], target[`${s}Knee`], target[`${s}Ankle`]), hipsDistance(target[`${s}Knee`], opponent), 50, 25);
    case "shoulder": {
      const r = shoulderRotation(target, s);
      // Grappling arms live in internal rotation (median 77° outside submissions), so
      // only what goes well past that counts; kimura finishes reach 112-170°.
      return { value: clamp01((r.angle - 80) / 50) * r.confidence, danger: r.angle > 110 && r.confidence > 0.5, measure: r.angle };
    }
    case "kneeTwist": {
      const r = kneeTwist(target, s);
      return { value: clamp01((r.angle - 40) / 30) * r.confidence, danger: r.angle > 60 && r.confidence > 0.5, measure: r.angle };
    }
    case "choke": {
      const gap = chokeGap(target, opponent);
      // With the bodies at full thickness (after the contact solver) a forearm cannot get
      // closer than about 9 cm to the neck's axis; finished chokes reach 8-12 cm.
      return { value: near(gap, 0.09, 0.19), danger: gap < 0.122, measure: gap };
    }
    case "neckCrank": {
      const f = flexion(target.Core, target.Neck, target.Head);
      return { value: clamp01((f - 50) / 30), danger: f > 75, measure: f };
    }
  }
}

/** Where the glow sits on the attacked body. */
export function glowPoint(kind: Kind, l: Landmarks, s: Side): THREE.Vector3 {
  switch (kind) {
    case "elbow": return l[`${s}Elbow`];
    case "shoulder": return l[`${s}Shoulder`];
    case "knee": return l[`${s}Knee`];
    case "kneeTwist": return l[`${s}Knee`].clone().lerp(l[`${s}Ankle`], 0.3);
    case "choke":
    case "neckCrank": return throat(l);
  }
}

/** A transition's submission kind: from its own tags, else from the positions it joins. */
export function submissionKind(...tagLists: string[][]): Kind | null {
  for (const tags of tagLists) for (const t of tags) if (KIND_BY_TAG[t]) return KIND_BY_TAG[t];
  return null;
}
