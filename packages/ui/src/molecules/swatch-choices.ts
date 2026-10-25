// Molecule: choices shown by their colour (the belts).
import { swatch } from "../atoms/swatch.ts";
import { el } from "../dom.ts";

export function swatchChoices<V extends string>(p: { items: { value: V; label: string; color: string }[]; value: V; onPick: (v: V) => void }): HTMLDivElement {
  return el("div", { className: "choices" }, ...p.items.map((it) => {
    const b = el("button", { type: "button", "aria-pressed": String(it.value === p.value) }, swatch(it.color), it.label);
    b.onclick = () => p.onPick(it.value);
    return b;
  }));
}
