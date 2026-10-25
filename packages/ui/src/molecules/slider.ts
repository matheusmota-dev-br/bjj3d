// Molecule: a labelled slider with words at both ends (Thickness: slim … sturdy).
import { el } from "../dom.ts";

export interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  ends: [string, string];
  onInput: (v: number) => void;
  /** Called when the person reaches for it (the camera can look at what it changes). */
  onFocus?: () => void;
}

export function slider(p: SliderProps): HTMLDivElement {
  const input = el("input", { type: "range", min: String(p.min), max: String(p.max), step: String(p.step), value: String(p.value) });
  if (p.onFocus) input.onpointerdown = input.onfocus = p.onFocus;
  input.oninput = () => p.onInput(Number(input.value));
  return el("div", { className: "slider" }, el("label", {}, p.label), el("output", {}), input,
    el("div", { className: "ends" }, el("span", {}, p.ends[0]), el("span", {}, p.ends[1])));
}
