// Organism: the fighters screen, a drawer over the view: a title and Done, a tab per
// fighter, and the controls (the page fills them).
import { button } from "../atoms/button.ts";
import { el } from "../dom.ts";

export interface Customizer { element: HTMLElement; tabs: HTMLDivElement; body: HTMLDivElement }

export function customizer(p: { title: string; done: string; onDone: () => void }): Customizer {
  const tabs = el("div", { className: "tabs", id: "cz-tabs" });
  const body = el("div", { id: "cz-body", className: "cz-body" });
  const element = el("aside", { id: "customizer", className: "customizer", hidden: true },
    el("div", { className: "cz-head" }, el("h2", { id: "cz-title" }, p.title), button({ label: p.done, id: "cz-done", onClick: p.onDone })),
    tabs, body);
  return { element, tabs, body };
}
