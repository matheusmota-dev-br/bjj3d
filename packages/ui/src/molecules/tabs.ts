// Molecule: tabs (Techniques / Finishes / Positions; amber / blue). One is selected.
import { dot } from "../atoms/dot.ts";
import { el } from "../dom.ts";

export interface TabsProps<V> {
  items: { value: V; label: string; color?: string }[];
  value: V;
  onPick: (v: V) => void;
  id?: string;
}

export function tabs<V>(p: TabsProps<V>): HTMLDivElement {
  return el("div", { className: "tabs", role: "tablist", id: p.id }, ...p.items.map((it) => {
    const b = el("button", { type: "button", role: "tab", "aria-selected": String(it.value === p.value) }, it.color ? dot(it.color, true) : null, it.label);
    b.onclick = () => p.onPick(it.value);
    return b;
  }));
}
