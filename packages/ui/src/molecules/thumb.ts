// Molecule: one cell of the filmstrip: a real frame of the step, its number, and a bar
// that fills while the step plays.
import { el } from "../dom.ts";

export const thumb = (i: number, src: string): HTMLDivElement => el("div", { className: "thumb", "data-i": String(i) },
  el("img", { src, alt: "", draggable: false }),
  el("span", { className: "n" }, String(i + 1)),
  el("span", { className: "fill" }));
