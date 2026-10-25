// Organism: the ring on the attacked joint while the lock is on, the angle next to it (an
// option), and at the finishing moment a pulse that leaves the joint.
import { el } from "../dom.ts";

export interface Attention {
  element: HTMLDivElement;
  /** Where the joint is on screen, or null when no lock is on. `hot` at the finishing moment. */
  set(at: { x: number; y: number } | null, hot: boolean, angle: string | null): void;
  /** A pulse leaving the joint, added to `stage` and removed when it ends. */
  pulse(stage: HTMLElement, at: { x: number; y: number }): void;
}

export function attention(): Attention {
  const angle = el("span", { id: "angle" });
  const element = el("div", { id: "attention" }, angle);
  return {
    element,
    set(at, hot, text) {
      element.classList.toggle("on", !!at);
      if (at) { element.style.left = `${at.x}px`; element.style.top = `${at.y}px`; }
      element.classList.toggle("hot", hot);
      angle.classList.toggle("on", !!at && text !== null);
      if (at && text !== null) angle.textContent = text;
    },
    pulse(stage, at) {
      const p = el("span", { className: "pulse", style: `left:${at.x}px;top:${at.y}px` });
      stage.append(p);
      p.addEventListener("animationend", () => p.remove());
    },
  };
}
