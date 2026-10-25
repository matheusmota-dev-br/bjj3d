// Organism: "Oss!", the greeting held for a second before a new fight starts: the word and
// two rings. `start` shows it and calls `done` after `ms`; `cancel` hides it at once.
import { el } from "../dom.ts";

export interface Oss { element: HTMLDivElement; start(ms: number, done: () => void): void; cancel(): void; readonly running: boolean }

export function oss(): Oss {
  const element = el("div", { id: "oss", hidden: true }, el("span", { className: "ring" }), el("span", { className: "ring" }), el("span", { className: "word" }, "Oss!"));
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    element.hidden = true;
  };
  return {
    element,
    cancel,
    get running() { return timer !== null; },
    start(ms, done) {
      cancel();
      element.hidden = false;
      // Restart the animations even if the element was just shown.
      for (const e of Array.from(element.children) as HTMLElement[]) { e.style.animation = "none"; void e.offsetWidth; e.style.animation = ""; }
      timer = setTimeout(() => { timer = null; element.hidden = true; done(); }, ms);
    },
  };
}
