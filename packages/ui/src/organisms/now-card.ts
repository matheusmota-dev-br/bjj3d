// Organism: what is on screen, at the top of the panel: a picture, the name, what it is,
// who moves, and the technique's steps (click one to jump there) and notes.
import { kindBadge } from "../atoms/badge.ts";
import { dot } from "../atoms/dot.ts";
import { el } from "../dom.ts";

export interface NowCardProps {
  kind?: string | null;
  title: string;
  what: string;
  mover?: { color: string; text: string };
  steps?: { text: string; onClick: () => void }[];
  notes?: string[];
}

export function nowCard(p: NowCardProps): HTMLElement {
  return el("section", { className: "now" },
    el("div", { className: "pic" }, el("img", { id: "now-pic", alt: "", draggable: false }), p.kind ? kindBadge(p.kind) : null),
    el("div", { className: "body" },
      el("h2", {}, p.title),
      el("p", { className: "what" }, p.what),
      p.mover ? el("p", { className: "mover" }, dot(p.mover.color), p.mover.text) : null,
      p.steps ? el("ol", { className: "steps" }, ...p.steps.map((s) => { const li = el("li", {}, s.text); li.onclick = s.onClick; return li; })) : null,
      ...(p.notes ?? []).map((n) => el("p", { className: "muted note" }, n))));
}
