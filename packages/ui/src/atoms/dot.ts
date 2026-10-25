// Atom: a fighter's dot, in the fighter's colour, before a name ("● amber").
import { el } from "../dom.ts";

export const dot = (color: string, gap = false): HTMLSpanElement =>
  el("span", { className: "dot", style: `background:${color}${gap ? ";margin-inline-end:6px" : ""}` });
