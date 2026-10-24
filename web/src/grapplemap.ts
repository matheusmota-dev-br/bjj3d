// Reader for the GrappleMap database (https://github.com/Eelis/GrappleMap, public domain).
//
// The file is a list of blocks. Each block is a description (first line is the name),
// optional `tags:`/`properties:`/`ref:` lines, then one or more poses. A block with one
// pose is a position; a block with two or more is a transition. A pose holds both
// players' 23 joints, each coordinate as two base-62 digits (value / 1000, x and z offset by 2).
// Ported from src/persistence.cpp and src/positions.cpp of the original.

export const JOINTS = [
  "LeftToe", "RightToe", "LeftHeel", "RightHeel", "LeftAnkle", "RightAnkle",
  "LeftKnee", "RightKnee", "LeftHip", "RightHip", "LeftShoulder", "RightShoulder",
  "LeftElbow", "RightElbow", "LeftWrist", "RightWrist", "LeftHand", "RightHand",
  "LeftFingers", "RightFingers", "Core", "Neck", "Head",
] as const;

export type Joint = (typeof JOINTS)[number];
export type Vec3 = [number, number, number];
export type Player = Record<Joint, Vec3>;
/** Both players: index 0 is "top" in GrappleMap's convention, 1 is "bottom". */
export type Pose = [Player, Player];

export interface Block {
  name: string;
  description: string[];
  tags: string[];
  properties: string[];
  refs: string[];
  poses: Pose[];
  /** The poses as stored in the file (base 62), for shipping without re-encoding. */
  encoded: string[];
  /** Line where the block starts, for pointing back at the source. */
  line: number;
}

const DIGITS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const POSE_CHARS = 2 * JOINTS.length * 3 * 2;

function digit(c: string): number {
  const d = DIGITS.indexOf(c);
  if (d < 0) throw new Error(`not a base-62 digit: ${c}`);
  return d;
}

export function decodePose(encoded: string): Pose {
  const s = encoded.replace(/\s+/g, "");
  if (s.length !== POSE_CHARS) throw new Error(`pose has ${s.length} chars, expected ${POSE_CHARS}`);
  let i = 0;
  const next = () => (digit(s[i++]) * 62 + digit(s[i++])) / 1000;
  const player = (): Player => {
    const p = {} as Player;
    for (const j of JOINTS) p[j] = [next() - 2, next(), next() - 2];
    return p;
  };
  return [player(), player()];
}

/** The inverse of decodePose: 2 base-62 digits per coordinate, millimetre steps. */
export function encodePose(p: Pose): string {
  let out = "";
  const put = (x: number) => {
    const v = Math.min(62 * 62 - 1, Math.max(0, Math.round(x * 1000)));
    out += DIGITS[Math.floor(v / 62)] + DIGITS[v % 62];
  };
  for (const pl of p) for (const j of JOINTS) { put(pl[j][0] + 2); put(pl[j][1]); put(pl[j][2] + 2); }
  return out;
}

/** A block in the file's own layout: description, tags, properties, refs, 4 lines per pose. */
export function formatBlock(b: Pick<Block, "description" | "tags" | "properties" | "refs" | "poses">): string {
  const lines = [...b.description];
  if (b.tags.length) lines.push("tags: " + b.tags.join(" "));
  if (b.properties.length) lines.push("properties: " + b.properties.join(" "));
  for (const r of b.refs) lines.push("ref: " + r);
  for (const p of b.poses) {
    const e = encodePose(p);
    for (let i = 0; i < e.length; i += 69) lines.push("    " + e.slice(i, i + 69));
  }
  return lines.join("\n") + "\n";
}

export function parse(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") { i++; continue; }
    const start = i;
    const meta: string[] = [];
    while (i < lines.length && !lines[i].startsWith("    ")) meta.push(lines[i++]);
    const poseLines: string[] = [];
    while (i < lines.length && lines[i].startsWith("    ")) poseLines.push(lines[i++]);

    const description = meta.filter((l) => !/^(tags|properties|ref):/.test(l));
    const field = (key: string) =>
      meta.filter((l) => l.startsWith(key + ":")).flatMap((l) => l.slice(key.length + 1).trim().split(/\s+/)).filter(Boolean);
    const encoded: string[] = [];
    for (let k = 0; k < poseLines.length; k += 4) encoded.push(poseLines.slice(k, k + 4).join("").replace(/\s+/g, ""));
    const poses = encoded.map(decodePose);

    blocks.push({
      name: (description[0] ?? "").replaceAll("\\n", " "),
      description,
      tags: field("tags"),
      properties: field("properties"),
      refs: meta.filter((l) => l.startsWith("ref:")).map((l) => l.slice(4).trim()),
      poses,
      encoded,
      line: start + 1,
    });
  }
  return blocks;
}

// --- Reorientation: GrappleMap treats two poses as the same position if one is a
// rotation about the vertical axis plus horizontal shift of the other, optionally
// mirrored (left/right swapped) and with the players swapped.

export interface Reorientation {
  offset: Vec3;
  angle: number;
  mirror: boolean;
  swapPlayers: boolean;
}

const dist2 = (a: Vec3, b: Vec3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function yrot(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * v[0] - s * v[2], v[1], s * v[0] + c * v[2]];
}

function mapPose(p: Pose, f: (v: Vec3) => Vec3): Pose {
  return p.map((pl) => {
    const q = {} as Player;
    for (const j of JOINTS) q[j] = f(pl[j]);
    return q;
  }) as Pose;
}

const otherSide = (j: Joint): Joint =>
  (j.startsWith("Left") ? "Right" + j.slice(4) : j.startsWith("Right") ? "Left" + j.slice(5) : j) as Joint;

export function mirror(p: Pose): Pose {
  return p.map((pl) => {
    const q = {} as Player;
    for (const j of JOINTS) {
      const v = pl[otherSide(j)];
      q[j] = [-v[0], v[1], v[2]];
    }
    return q;
  }) as Pose;
}

export function reorient(p: Pose, r: Reorientation): Pose {
  let q = mapPose(p, (v) => {
    const w = yrot(v, r.angle);
    return [w[0] + r.offset[0], w[1] + r.offset[1], w[2] + r.offset[2]];
  });
  if (r.mirror) q = mirror(q);
  if (r.swapPlayers) q = [q[1], q[0]];
  return q;
}

/** GrappleMap's tolerance: every joint within 4 cm. */
export const SAME = 0.04;

export function basicallySame(a: Pose, b: Pose, tolerance = SAME): boolean {
  for (const k of [0, 1] as const)
    for (const j of JOINTS) if (dist2(a[k][j], b[k][j]) > tolerance * tolerance) return false;
  return true;
}

const xzAngle = (v: Vec3) => Math.atan2(v[0], v[2]);

function withoutMirrorAndSwap(a: Pose, b: Pose, tolerance: number): { offset: Vec3; angle: number } | null {
  const a0 = a[0].Head, a1 = a[1].Head, b0 = b[0].Head, b1 = b[1].Head;
  const angle = xzAngle([b1[0] - b0[0], 0, b1[2] - b0[2]]) - xzAngle([a1[0] - a0[0], 0, a1[2] - a0[2]]);
  // Try both rotation senses; the original's matrix convention is easy to misread,
  // and only the correct one makes the heads coincide.
  for (const ang of [angle, -angle]) {
    const r0 = yrot(a0, ang);
    const offset: Vec3 = [b0[0] - r0[0], b0[1] - r0[1], b0[2] - r0[2]];
    const r = { offset, angle: ang, mirror: false, swapPlayers: false };
    if (basicallySame(reorient(a, r), b, tolerance)) return { offset, angle: ang };
  }
  return null;
}

/** The reorientation that turns `a` into `b`, if they are the same position. */
export function isReoriented(a: Pose, b: Pose, tolerance = SAME): Reorientation | null {
  const h2h = (p: Pose) => dist2(p[0].Head, p[1].Head);
  if (Math.abs(h2h(a) - h2h(b)) > 0.05) return null;
  for (const swapPlayers of [false, true]) {
    const target: Pose = swapPlayers ? [b[1], b[0]] : b;
    for (const mir of [false, true]) {
      const r = withoutMirrorAndSwap(a, mir ? mirror(target) : target, tolerance);
      if (r) return { ...r, mirror: mir, swapPlayers };
    }
  }
  return null;
}

export interface Graph {
  positions: Block[];
  transitions: { block: Block; from: number | null; to: number | null }[];
}

/** Splits blocks into positions and transitions and links each transition's ends to positions. */
export function buildGraph(blocks: Block[]): Graph {
  const positions = blocks.filter((b) => b.poses.length === 1);
  const find = (p: Pose) => {
    const i = positions.findIndex((n) => isReoriented(n.poses[0], p));
    return i < 0 ? null : i;
  };
  const transitions = blocks
    .filter((b) => b.poses.length > 1)
    .map((block) => ({ block, from: find(block.poses[0]), to: find(block.poses.at(-1)!) }));
  return { positions, transitions };
}
