// Atom: a button. Four kinds, one job each:
// - chip: a small action inside a panel (Done, Reset, Fighters); `round` for a single symbol.
// - float: over the 3D view, on its own (☰ Browse, ⚙).
// - icon: one symbol in a bar (▶ in the filmstrip).
// - primary: the one thing to do next (Got it).
import { el } from "../dom.ts";

export type ButtonKind = "chip" | "float" | "icon" | "primary";

export interface ButtonProps {
  label: string;
  kind?: ButtonKind;
  round?: boolean;
  id?: string;
  title?: string;
  className?: string;
  /** For a toggle: whether it is on (aria-pressed). */
  pressed?: boolean;
  onClick?: (e: MouseEvent) => void;
}

const CLASS: Record<ButtonKind, string> = { chip: "chip-btn", float: "float-btn", icon: "icon-btn", primary: "primary" };

export function button(p: ButtonProps): HTMLButtonElement {
  const className = [CLASS[p.kind ?? "chip"], p.round ? "round" : "", p.className ?? ""].filter(Boolean).join(" ");
  const b = el("button", { type: "button", className, id: p.id, title: p.title, "aria-pressed": p.pressed === undefined ? undefined : String(p.pressed) }, p.label);
  if (p.round) b.setAttribute("aria-label", p.label);
  if (p.onClick) b.onclick = p.onClick;
  return b;
}
