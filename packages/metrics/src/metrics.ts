// Joint load from geometry alone. GrappleMap has no forces or timing, so the "tension"
// of a submission is how far the attacked joint is pushed through its range, gated by
// something of the opponent being where the leverage comes from. Each submission kind
// has one metric; the viewer lights only the joint that the technique attacks.
//
// Thresholds are calibrated with `npm run validate` over the whole database; see
// docs/validation.md for the numbers they produce.

import * as THREE from "three";
import type { Joint } from "@bjj3d/core";
import type { Landmarks } from "./landmarks.ts";

export type Side = "Left" | "Right";
/** A submission kind's id: one of the built-ins below, or any id a registry adds. */
export type Kind = string;
export type BuiltinKind = "elbow" | "shoulder" | "knee" | "kneeTwist" | "choke" | "neckCrank";

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

/**
 * One submission kind: which GrappleMap tags select it, how far its joint is pushed, and
 * where the glow sits. A new submission is one of these, passed to `createMetrics`.
 */
export interface SubmissionMetric {
  id: Kind;
  /** GrappleMap tags that name this submission. */
  tags: string[];
  /** Whether it attacks one side (an arm, a leg) or the middle (the neck). */
  sided: boolean;
  /** Where the danger range starts, in the unit of `Reading.measure`. */
  danger: { value: number; unit: "deg" | "m"; when: "below" | "above" };
  read(target: Landmarks, opponent: Landmarks, side: Side): Reading;
  /** Where the glow sits on the attacked body. */
  glowPoint(target: Landmarks, side: Side): THREE.Vector3;
}

const elbow: SubmissionMetric = {
  id: "elbow",
  tags: ["armbar"],
  sided: true,
  danger: { value: 14, unit: "deg", when: "below" },
  read: (t, o, s) => extension(flexion(t[`${s}Shoulder`], t[`${s}Elbow`], t[`${s}Wrist`]), hipsDistance(t[`${s}Elbow`], o), 40, elbow.danger.value),
  glowPoint: (l, s) => l[`${s}Elbow`],
};

const knee: SubmissionMetric = {
  id: "knee",
  tags: ["knee_bar"],
  sided: true,
  danger: { value: 25, unit: "deg", when: "below" },
  read: (t, o, s) => extension(flexion(t[`${s}Hip`], t[`${s}Knee`], t[`${s}Ankle`]), hipsDistance(t[`${s}Knee`], o), 50, knee.danger.value),
  glowPoint: (l, s) => l[`${s}Knee`],
};

const shoulder: SubmissionMetric = {
  id: "shoulder",
  tags: ["kimura", "omoplata", "monoplata", "shoulder_lock"],
  sided: true,
  danger: { value: 110, unit: "deg", when: "above" },
  read: (t, _o, s) => {
    const r = shoulderRotation(t, s);
    // Grappling arms live in internal rotation (median 77° outside submissions), so
    // only what goes well past that counts; kimura finishes reach 112-170°.
    return { value: clamp01((r.angle - 80) / 50) * r.confidence, danger: r.angle > shoulder.danger.value && r.confidence > 0.5, measure: r.angle };
  },
  glowPoint: (l, s) => l[`${s}Shoulder`],
};

const kneeTwistMetric: SubmissionMetric = {
  id: "kneeTwist",
  tags: ["heel_hook", "toehold"],
  sided: true,
  danger: { value: 60, unit: "deg", when: "above" },
  read: (t, _o, s) => {
    const r = kneeTwist(t, s);
    return { value: clamp01((r.angle - 40) / 30) * r.confidence, danger: r.angle > kneeTwistMetric.danger.value && r.confidence > 0.5, measure: r.angle };
  },
  glowPoint: (l, s) => l[`${s}Knee`].clone().lerp(l[`${s}Ankle`], 0.3),
};

const choke: SubmissionMetric = {
  id: "choke",
  tags: ["rear_naked_choke", "guillotine", "darce", "triangle", "arm_triangle", "arm_choke"],
  sided: false,
  danger: { value: 0.122, unit: "m", when: "below" },
  read: (t, o) => {
    const gap = chokeGap(t, o);
    // With the bodies at full thickness (after the contact solver) a forearm cannot get
    // closer than about 9 cm to the neck's axis; finished chokes reach 8-12 cm.
    return { value: near(gap, 0.09, 0.19), danger: gap < choke.danger.value, measure: gap };
  },
  glowPoint: (l) => throat(l),
};

const neckCrank: SubmissionMetric = {
  id: "neckCrank",
  tags: ["neck_crank"],
  sided: false,
  danger: { value: 75, unit: "deg", when: "above" },
  read: (t) => {
    const f = flexion(t.Core, t.Neck, t.Head);
    return { value: clamp01((f - 50) / 30), danger: f > neckCrank.danger.value, measure: f };
  },
  glowPoint: (l) => throat(l),
};

/** The six readings this project ships, calibrated against GrappleMap (docs/validation.md). */
export const builtinMetrics: SubmissionMetric[] = [elbow, shoulder, knee, kneeTwistMetric, choke, neckCrank];

/** A set of submission metrics, looked up by id or by GrappleMap tag. */
export class MetricRegistry {
  private byId = new Map<Kind, SubmissionMetric>();
  private byTag = new Map<string, SubmissionMetric>();

  /** Later definitions replace earlier ones with the same id or tag. */
  constructor(defs: SubmissionMetric[]) {
    for (const d of defs) {
      this.byId.set(d.id, d);
      for (const t of d.tags) this.byTag.set(t, d);
    }
  }

  get ids(): Kind[] { return [...this.byId.keys()]; }

  get(kind: Kind): SubmissionMetric {
    const d = this.byId.get(kind);
    if (!d) throw new Error(`no submission metric "${kind}"`);
    return d;
  }

  /** A transition's submission kind: from its own tags, else from the positions it joins. */
  kindOf(...tagLists: string[][]): Kind | null {
    for (const tags of tagLists) for (const t of tags) { const d = this.byTag.get(t); if (d) return d.id; }
    return null;
  }

  /** The sides to try for a kind: both for a limb, one for the neck. */
  sides(kind: Kind): Side[] { return this.get(kind).sided ? ["Left", "Right"] : ["Left"]; }
}

export const createMetrics = (defs: SubmissionMetric[] = builtinMetrics) => new MetricRegistry(defs);

/** The built-ins, for callers that do not bring their own. */
export const defaultMetrics = createMetrics();

/** GrappleMap tags that name a built-in submission, and the kind each one is. */
export const KIND_BY_TAG: Record<string, Kind> = Object.fromEntries(builtinMetrics.flatMap((d) => d.tags.map((t) => [t, d.id])));
export const SIDED: Record<Kind, boolean> = Object.fromEntries(builtinMetrics.map((d) => [d.id, d.sided]));

export const read = (kind: Kind, target: Landmarks, opponent: Landmarks, s: Side = "Left"): Reading => defaultMetrics.get(kind).read(target, opponent, s);
export const glowPoint = (kind: Kind, l: Landmarks, s: Side): THREE.Vector3 => defaultMetrics.get(kind).glowPoint(l, s);
export const submissionKind = (...tagLists: string[][]): Kind | null => defaultMetrics.kindOf(...tagLists);
