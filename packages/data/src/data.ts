// The database as the viewer sees it: graph.json built by scripts/build-data.ts.

import type { Pose } from "@bjj3d/core";
import { decodePose } from "@bjj3d/grapplemap";
import type { Kind } from "@bjj3d/metrics";

/** A text in several languages; English is always there. */
export type Text = { en: string } & Partial<Record<string, string>>;

export interface PositionEntry {
  name: string;
  description: string[];
  tags: string[];
  refs: string[];
  line: number;
  pose: string;
}

export interface TransitionEntry {
  name: string;
  description: string[];
  tags: string[];
  /** GrappleMap's: "top"/"bottom" (who moves), "bidirectional", "detailed". */
  properties: string[];
  refs: string[];
  line: number;
  from: number | null;
  to: number | null;
  kind: Kind | null;
  /** Solved and densified: keyframe k is poses[k * substeps]. */
  poses: string[];
}

/** A hand-written technique in data/techniques/: names, steps and notes over a transition. */
export interface TechniqueFile {
  id: string;
  reviewed: boolean;
  names: Text;
  source: { grapplemap_line: number; from: string; to: string };
  steps: { frame: number; text: Text }[];
  risk?: Text;
  note?: Text;
}

export interface GraphFile {
  /** Frames per keyframe gap in `poses` (the contact solver adds in-betweens). */
  substeps: number;
  positions: PositionEntry[];
  transitions: TransitionEntry[];
  /** Keyed by transition index. */
  techniques: Record<number, TechniqueFile>;
}

/** What the viewer can show: a position, or a transition played forwards or backwards. */
export type Ref = { type: "p"; i: number } | { type: "t"; i: number; reversed: boolean };

export const refKey = (r: Ref) => (r.type === "p" ? `p/${r.i}` : `t/${r.i}${r.reversed ? "r" : ""}`);

export function parseRef(s: string): Ref | null {
  const m = /^(p|t)\/(\d+)(r?)$/.exec(s);
  if (!m) return null;
  return m[1] === "p" ? { type: "p", i: +m[2] } : { type: "t", i: +m[2], reversed: m[3] === "r" };
}

export class Db {
  readonly outgoing: Ref[][];
  readonly incoming: Ref[][];
  private cache = new Map<string, Pose[]>();
  readonly file: GraphFile;

  constructor(file: GraphFile) {
    this.file = file;
    this.outgoing = file.positions.map(() => []);
    this.incoming = file.positions.map(() => []);
    file.transitions.forEach((t, i) => {
      if (t.from !== null) this.outgoing[t.from].push({ type: "t", i, reversed: false });
      if (t.to !== null) this.incoming[t.to].push({ type: "t", i, reversed: false });
      if (t.properties.includes("bidirectional") && t.from !== null && t.to !== null) {
        this.outgoing[t.to].push({ type: "t", i, reversed: true });
        this.incoming[t.from].push({ type: "t", i, reversed: true });
      }
    });
  }

  static async load(url = "graph.json") {
    return new Db(await (await fetch(url)).json());
  }

  poses(r: Ref): Pose[] {
    const key = refKey(r);
    let p = this.cache.get(key);
    if (!p) {
      p = r.type === "p" ? [decodePose(this.file.positions[r.i].pose)] : this.file.transitions[r.i].poses.map(decodePose);
      if (r.type === "t" && r.reversed) p = [...p].reverse();
      this.cache.set(key, p);
    }
    return p;
  }

  /** Position a ref starts and ends in. */
  ends(r: Ref): { from: number | null; to: number | null } {
    if (r.type === "p") return { from: r.i, to: r.i };
    const t = this.file.transitions[r.i];
    return r.reversed ? { from: t.to, to: t.from } : { from: t.from, to: t.to };
  }

  name(r: Ref): string {
    return r.type === "p" ? this.file.positions[r.i].name : this.file.transitions[r.i].name;
  }

  technique(r: Ref): TechniqueFile | null {
    return r.type === "t" && !r.reversed ? this.file.techniques[r.i] ?? null : null;
  }

  /** Who moves in a transition: GrappleMap's player 0 is "top", player 1 "bottom". */
  mover(r: Ref): 0 | 1 | null {
    if (r.type !== "t") return null;
    const p = this.file.transitions[r.i].properties;
    return p.includes("top") ? 0 : p.includes("bottom") ? 1 : null;
  }

  search(query: string, limit = 80): Ref[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (name: string, tags: string[]) => {
      const hay = (name + " " + tags.join(" ")).toLowerCase().replaceAll("_", " ");
      return words.every((w) => hay.includes(w));
    };
    const out: Ref[] = [];
    this.file.positions.forEach((p, i) => { if (hit(p.name, p.tags)) out.push({ type: "p", i }); });
    this.file.transitions.forEach((t, i) => {
      const ends = [t.from, t.to].map((x) => (x === null ? "" : this.file.positions[x].name)).join(" ");
      if (hit(t.name + " " + ends, t.tags)) out.push({ type: "t", i, reversed: false });
    });
    return out.slice(0, limit);
  }
}
