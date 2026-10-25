// Molecule: a row of buttons where exactly one is chosen (look, place, camera, speed).
// The state lives outside: `get` says what is chosen, `set` is called on a click, and
// `refresh()` marks the chosen one again after anything changed.
import { el } from "../dom.ts";

export interface SegmentedProps<V extends string | number> {
  items: [V, string][];
  get: () => V;
  set: (v: V) => void;
  id?: string;
  /** Extra classes, e.g. "glass" for the camera chip over the view. */
  className?: string;
}

export interface Segmented { element: HTMLDivElement; refresh(): void }

export function segmented<V extends string | number>(p: SegmentedProps<V>): Segmented {
  const element = el("div", { className: ["seg", p.className].filter(Boolean).join(" "), id: p.id });
  const buttons = p.items.map(([value, label]) => {
    const b = el("button", { type: "button", "aria-pressed": "false", "data-value": String(value) }, label);
    b.onclick = () => p.set(value);
    return [value, b] as const;
  });
  element.append(...buttons.map(([, b]) => b));
  const refresh = () => buttons.forEach(([v, b]) => b.setAttribute("aria-pressed", String(v === p.get())));
  refresh();
  return { element, refresh };
}
