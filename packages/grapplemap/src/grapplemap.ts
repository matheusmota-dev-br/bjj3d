// Reader for the GrappleMap database (https://github.com/Eelis/GrappleMap, public domain).
//
// The file is a list of blocks. Each block is a description (first line is the name),
// optional `tags:`/`properties:`/`ref:` lines, then one or more poses. A block with one
// pose is a position; a block with two or more is a transition. A pose holds both
// players' 23 joints, each coordinate as two base-62 digits (value / 1000, x and z offset by 2).
// Ported from src/persistence.cpp of the original; the skeleton and pose operations are in
// @bjj3d/core.

import { isReoriented, JOINTS, type Player, type Pose } from "@bjj3d/core";

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
