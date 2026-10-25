// Molecules: one option of the settings, always with a line saying what it does.
// - optionToggle: a checkbox (Loop, Mirror, Oss!…).
// - optionChoice: a few choices (Show: both, amber, blue).
import { el } from "../dom.ts";
import { segmented } from "./segmented.ts";

export interface Option { element: HTMLElement; refresh(): void }

export function optionToggle(p: { label: string; hint: string; get: () => boolean; set: (on: boolean) => void }): Option {
  const box = el("input", { type: "checkbox" });
  box.onchange = () => p.set(box.checked);
  const refresh = () => { box.checked = p.get(); };
  refresh();
  return { element: el("label", { className: "option" }, box, el("div", {}, el("b", {}, p.label), el("span", {}, p.hint))), refresh };
}

export function optionChoice(p: { label: string; hint: string; items: [string, string][]; get: () => string; set: (v: string) => void }): Option {
  const seg = segmented({ items: p.items, get: p.get, set: p.set });
  return { element: el("div", { className: "option" }, el("div", {}, el("b", {}, p.label), el("span", {}, p.hint), seg.element)), refresh: seg.refresh };
}
