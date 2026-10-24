// Offline contact solver: makes GrappleMap's stick figures as thick as the bodies drawn
// over them, and separates what then overlaps.
//
// Each player becomes capsules sized from the body (data/body/capsules.json, measured in
// Blender). For each frame, a few dozen position-based iterations:
// - push apart capsules of different players that overlap by more than a centimetre, and
//   a player's forearms, hands, shins and feet out of their own torso and limbs: touching
//   is allowed, so grips, hooks and pressure stay;
// - keep every bone at its length in the original frame;
// - keep everything above the mat;
// - pull gently back toward the original pose, so the technique does not drift.
//
// Transitions also get a frame between each pair of keyframes, interpolated and solved,
// so limbs do not pass through each other on the way. Corrections are smoothed over time
// (except at the ends, which are shared with positions and must stay identical) so
// nothing pops from one frame to the next.

import { JOINTS, type Joint, type Player, type Pose } from "./grapplemap.ts";

export interface Radii {
  upperArm: number; foreArm: number; hand: number; thigh: number; shin: number; foot: number;
  chest: number; abdomen: number; pelvis: number; head: number;
}

/** Frames between keyframes after densifying (2: one in-between per pair). */
export const SUBSTEPS = 2;

const ITERATIONS = 40;
const OVERLAP = 0.01; // metres of overlap allowed: skin and muscle give a little
const ANCHOR = 0.08; // pull toward the original pose, per iteration
// The torso is wider than it is deep; a round capsule of the measured median would push
// a leg lying across the belly too far up.
const TORSO = 0.8;

type Seg = [Joint, Joint, number];

function capsules(r: Radii): Seg[] {
  const out: Seg[] = [
    ["Head", "Head", r.head],
    ["Neck", "Core", r.chest * TORSO],
    ["Core", "LeftHip", r.abdomen * TORSO * 0.75],
    ["Core", "RightHip", r.abdomen * TORSO * 0.75],
    ["LeftHip", "RightHip", r.pelvis],
    ["LeftShoulder", "RightShoulder", r.upperArm],
  ];
  for (const s of ["Left", "Right"] as const)
    out.push(
      [`${s}Shoulder`, `${s}Elbow`, r.upperArm], [`${s}Elbow`, `${s}Wrist`, r.foreArm], [`${s}Wrist`, `${s}Fingers`, r.hand * 0.5],
      [`${s}Hip`, `${s}Knee`, r.thigh], [`${s}Knee`, `${s}Ankle`, r.shin], [`${s}Heel`, `${s}Toe`, r.foot],
    );
  return out;
}

/** Bones kept at their length: the segments GrappleMap draws. */
export const BONES: [Joint, Joint][] = [
  ["Head", "Neck"], ["Neck", "Core"], ["Core", "LeftHip"], ["Core", "RightHip"], ["LeftHip", "RightHip"],
  ["LeftShoulder", "RightShoulder"], ["LeftShoulder", "Neck"], ["RightShoulder", "Neck"],
  ...(["Left", "Right"] as const).flatMap((s): [Joint, Joint][] => [
    [`${s}Shoulder`, `${s}Elbow`], [`${s}Elbow`, `${s}Wrist`], [`${s}Wrist`, `${s}Hand`], [`${s}Hand`, `${s}Fingers`], [`${s}Wrist`, `${s}Fingers`],
    [`${s}Hip`, `${s}Knee`], [`${s}Knee`, `${s}Ankle`], [`${s}Ankle`, `${s}Heel`], [`${s}Ankle`, `${s}Toe`], [`${s}Heel`, `${s}Toe`],
    [`${s}Shoulder`, "Core"], [`${s}Hip`, "Neck"],
  ]),
];

/** Torso joints move less than hands and feet when something must give. */
const INV_MASS: Partial<Record<Joint, number>> = { Core: 0.3, Neck: 0.4, LeftHip: 0.35, RightHip: 0.35, LeftShoulder: 0.5, RightShoulder: 0.5, Head: 0.6 };
const invMass = (j: Joint) => INV_MASS[j] ?? 1;

/** Within one player: distal limb parts against the torso, the head and the other limbs. */
function selfPairs(caps: Seg[]): [number, number][] {
  const distal = (c: Seg) => /Wrist|Fingers|Ankle|Toe/.test(c[1]);
  const shares = (a: Seg, b: Seg) => a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1];
  const limb = (c: Seg) => {
    const side = c[0].startsWith("Left") ? "L" : c[0].startsWith("Right") ? "R" : "";
    return side && side + (/Shoulder|Elbow|Wrist|Hand|Fingers/.test(c[0]) ? "arm" : "leg");
  };
  const out: [number, number][] = [];
  caps.forEach((a, i) => caps.forEach((b, k) => {
    if (k <= i || shares(a, b) || !(distal(a) || distal(b))) return;
    if (limb(a) && limb(a) === limb(b)) return; // a limb folds on itself
    out.push([i, k]);
  }));
  return out;
}

// --- geometry on plain arrays: thousands of frames, so no objects in the inner loop

type P = Float64Array; // 46 joints × xyz, player 0 then player 1
const JI = new Map(JOINTS.map((j, i) => [j, i]));
const idx = (player: number, j: Joint) => (player * JOINTS.length + JI.get(j)!) * 3;

function toArray(p: Pose): P {
  const a = new Float64Array(JOINTS.length * 6);
  for (const pl of [0, 1]) for (const j of JOINTS) a.set(p[pl][j], idx(pl, j));
  return a;
}

function toPose(a: P): Pose {
  return [0, 1].map((pl) => {
    const o = {} as Player;
    for (const j of JOINTS) { const i = idx(pl, j); o[j] = [a[i], a[i + 1], a[i + 2]]; }
    return o;
  }) as Pose;
}

/** Closest points between segments [p1,q1] and [p2,q2]: parameters s, t in [0, 1]. */
function closest(a: P, p1: number, q1: number, p2: number, q2: number): [number, number] {
  const d1x = a[q1] - a[p1], d1y = a[q1 + 1] - a[p1 + 1], d1z = a[q1 + 2] - a[p1 + 2];
  const d2x = a[q2] - a[p2], d2y = a[q2 + 1] - a[p2 + 1], d2z = a[q2 + 2] - a[p2 + 2];
  const rx = a[p1] - a[p2], ry = a[p1 + 1] - a[p2 + 1], rz = a[p1 + 2] - a[p2 + 2];
  const A = d1x * d1x + d1y * d1y + d1z * d1z, E = d2x * d2x + d2y * d2y + d2z * d2z;
  const F = d2x * rx + d2y * ry + d2z * rz;
  let s = 0, t = 0;
  if (A < 1e-9 && E < 1e-9) return [0, 0];
  if (A < 1e-9) return [0, Math.min(1, Math.max(0, F / E))];
  const C = d1x * rx + d1y * ry + d1z * rz;
  if (E < 1e-9) return [Math.min(1, Math.max(0, -C / A)), 0];
  const B = d1x * d2x + d1y * d2y + d1z * d2z, den = A * E - B * B;
  s = den > 1e-12 ? Math.min(1, Math.max(0, (B * F - C * E) / den)) : 0;
  t = (B * s + F) / E;
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -C / A)); }
  else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (B - C) / A)); }
  return [s, t];
}

interface Model { caps: { a: number; b: number; ja: Joint; jb: Joint; r: number; pl: number }[]; cross: [number, number][]; self: [number, number][]; floor: Map<number, number> }

function model(r: Radii): Model {
  const segs = capsules(r);
  const caps = [0, 1].flatMap((pl) => segs.map(([ja, jb, rad]) => ({ a: idx(pl, ja), b: idx(pl, jb), ja, jb, r: rad, pl })));
  const n = segs.length;
  const cross: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) cross.push([i, n + k]);
  const self = selfPairs(segs).flatMap(([i, k]) => [[i, k], [n + i, n + k]] as [number, number][]);
  // A joint may not go lower than the thickest capsule it carries.
  const floor = new Map<number, number>();
  for (const c of caps) for (const j of [c.a, c.b]) floor.set(j, Math.max(floor.get(j) ?? 0, c.r * 0.9));
  return { caps, cross, self, floor };
}

/** Corrections gathered over one sweep and applied together, so the order of the
 * constraints does not matter: a mirrored or player-swapped pose solves to the mirrored or
 * swapped result, which keeps chained transitions continuous. */
interface Acc { d: Float64Array; n: Float64Array }

function add(acc: Acc, j: number, x: number, y: number, z: number) {
  acc.d[j] += x; acc.d[j + 1] += y; acc.d[j + 2] += z; acc.n[j / 3] += 1;
}

function flush(a: P, acc: Acc) {
  for (let j = 0; j < a.length; j += 3) {
    const n = acc.n[j / 3];
    if (n) { a[j] += acc.d[j] / n; a[j + 1] += acc.d[j + 1] / n; a[j + 2] += acc.d[j + 2] / n; }
  }
  acc.d.fill(0); acc.n.fill(0);
}

function separate(a: P, acc: Acc, m: Model, i: number, k: number, stiffness: number) {
  const c1 = m.caps[i], c2 = m.caps[k];
  const [s, t] = closest(a, c1.a, c1.b, c2.a, c2.b);
  let nx = 0, ny = 0, nz = 0;
  for (let d = 0; d < 3; d++) {
    const x1 = a[c1.a + d] + (a[c1.b + d] - a[c1.a + d]) * s;
    const x2 = a[c2.a + d] + (a[c2.b + d] - a[c2.a + d]) * t;
    if (d === 0) nx = x1 - x2; else if (d === 1) ny = x1 - x2; else nz = x1 - x2;
  }
  const dist = Math.hypot(nx, ny, nz);
  const min = c1.r + c2.r - OVERLAP;
  if (dist >= min) return 0;
  if (dist < 1e-6) { nx = 0; ny = 1; nz = 0; } else { nx /= dist; ny /= dist; nz /= dist; }
  // Split the push between the four endpoints by how close each is and how heavy it is.
  const w = [
    [c1.a, (1 - s) * invMass(c1.ja), 1], [c1.b, s * invMass(c1.jb), 1],
    [c2.a, (1 - t) * invMass(c2.ja), -1], [c2.b, t * invMass(c2.jb), -1],
  ] as const;
  const sum = w.reduce((x, [, wi]) => x + wi * wi, 0) || 1;
  const push = ((min - dist) * stiffness) / sum;
  for (const [j, wi, sign] of w) add(acc, j, nx * push * wi * sign, ny * push * wi * sign, nz * push * wi * sign);
  return min - dist;
}

function keepLengths(a: P, acc: Acc, lengths: Float64Array, bones: [number, number, number, number][]) {
  bones.forEach(([p, q, mp, mq], b) => {
    const dx = a[q] - a[p], dy = a[q + 1] - a[p + 1], dz = a[q + 2] - a[p + 2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-9) return;
    const k = (d - lengths[b]) / (d * (mp + mq || 1));
    add(acc, p, dx * k * mp, dy * k * mp, dz * k * mp);
    add(acc, q, -dx * k * mq, -dy * k * mq, -dz * k * mq);
  });
}

const BONE_IDX = [0, 1].flatMap((pl) => BONES.map(([j, k]) => [idx(pl, j), idx(pl, k), invMass(j), invMass(k)] as [number, number, number, number]));

function solveFrame(input: P, m: Model, iterations = ITERATIONS, anchor = ANCHOR): P {
  const a = new Float64Array(input);
  const acc: Acc = { d: new Float64Array(a.length), n: new Float64Array(a.length / 3) };
  const lengths = new Float64Array(BONE_IDX.map(([p, q]) => Math.hypot(input[q] - input[p], input[q + 1] - input[p + 1], input[q + 2] - input[p + 2])));
  for (let it = 0; it < iterations; it++) {
    for (const [i, k] of m.cross) separate(a, acc, m, i, k, 1);
    for (const [i, k] of m.self) separate(a, acc, m, i, k, 0.5);
    flush(a, acc);
    for (let pass = 0; pass < 2; pass++) { keepLengths(a, acc, lengths, BONE_IDX); flush(a, acc); }
    for (const [j, r] of m.floor) if (a[j + 1] < r) a[j + 1] = r;
    for (let i = 0; i < a.length; i++) a[i] += (input[i] - a[i]) * anchor;
  }
  return a;
}

/** Deepest overlap between the two players, in metres: what the solver is meant to remove. */
export function deepestOverlap(p: Pose, r: Radii): number {
  const m = model(r), a = toArray(p);
  let worst = 0;
  for (const [i, k] of m.cross) {
    const c1 = m.caps[i], c2 = m.caps[k];
    const [s, t] = closest(a, c1.a, c1.b, c2.a, c2.b);
    let d2 = 0;
    for (let d = 0; d < 3; d++) {
      const x = a[c1.a + d] + (a[c1.b + d] - a[c1.a + d]) * s - (a[c2.a + d] + (a[c2.b + d] - a[c2.a + d]) * t);
      d2 += x * x;
    }
    worst = Math.max(worst, c1.r + c2.r - Math.sqrt(d2));
  }
  return worst;
}

export class ContactSolver {
  private m: Model;
  constructor(radii: Radii) { this.m = model(radii); }

  /** A single pose (a position, or the end of a transition). */
  pose(p: Pose): Pose {
    return toPose(solveFrame(toArray(p), this.m));
  }

  /** A transition: densified to SUBSTEPS frames per keyframe gap, solved, smoothed in time. */
  transition(keys: Pose[]): Pose[] {
    const k = keys.map(toArray);
    const input: P[] = [];
    for (let i = 0; i < k.length - 1; i++)
      for (let s = 0; s < SUBSTEPS; s++) input.push(s === 0 ? k[i] : catmull(k[Math.max(0, i - 1)], k[i], k[i + 1], k[Math.min(k.length - 1, i + 2)], s / SUBSTEPS));
    input.push(k[k.length - 1]);
    const solved = input.map((f) => solveFrame(f, this.m));
    const n = solved.length;
    const corr = solved.map((f, i) => f.map((v, c) => v - input[i][c]));
    for (let pass = 0; pass < 2; pass++) {
      const prev = corr.map((c) => c.slice());
      for (let i = 1; i < n - 1; i++) for (let c = 0; c < corr[i].length; c++) corr[i][c] = 0.25 * prev[i - 1][c] + 0.5 * prev[i][c] + 0.25 * prev[i + 1][c];
    }
    return input.map((f, i) => {
      if (i === 0 || i === n - 1) return toPose(solved[i]);
      const smoothed = f.map((v, c) => v + corr[i][c]);
      return toPose(solveFrame(smoothed, this.m, 6, 0));
    });
  }
}

function catmull(p0: P, p1: P, p2: P, p3: P, u: number): P {
  const u2 = u * u, u3 = u2 * u;
  return p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3));
}
