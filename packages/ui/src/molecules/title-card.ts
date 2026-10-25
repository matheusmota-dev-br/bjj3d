// Molecule: what is on screen, top left: the submission badge, the name, and where it goes.
import { el } from "../dom.ts";

export interface TitleCard { element: HTMLDivElement; set(p: { kind: string; title: string; ends: string }): void }

export function titleCard(): TitleCard {
  const kind = el("span", { id: "kind", className: "kind" });
  const title = el("h1", { id: "title" });
  const ends = el("p", { id: "ends" });
  return {
    element: el("div", { id: "title-card", className: "glass" }, kind, title, ends),
    set(p) { kind.textContent = p.kind; title.textContent = p.title; ends.textContent = p.ends; },
  };
}
