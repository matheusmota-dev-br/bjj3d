// Atom: a colour sample, as on the belt buttons.
import { el } from "../dom.ts";

export const swatch = (color: string): HTMLSpanElement => el("span", { className: "swatch", style: `background:${color}` });
