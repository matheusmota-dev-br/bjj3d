// Organism: the player under the move: the risk line, the caption, and the filmstrip, with
// a real frame of every step. Click a frame to jump, drag across to scrub; the last cell
// offers the next move.
import { button } from "../atoms/button.ts";
import { el } from "../dom.ts";
import { thumb } from "../molecules/thumb.ts";

export interface FilmstripProps {
  onPlay: () => void;
  /** A frame was pressed: stop and go to its step. */
  onPick: (step: number) => void;
  /** Dragging across the strip: a time between steps. */
  onScrub: (time: number) => void;
}

export interface NextMove { href: string; label: string; title: string; more?: string; onMore: () => void; onClick: () => void }

export interface Filmstrip {
  element: HTMLDivElement;
  play: HTMLButtonElement;
  thumbs: HTMLDivElement;
  /** Steps start at these times; the last one runs to `last`. */
  setSteps(stops: number[], images: string[], last: number): void;
  setNext(next: NextMove | null): void;
  /** Marks the step being played and fills it up to the next one. */
  setTime(time: number, playing: boolean, labels: { play: string; pause: string }): void;
  /** Returns whether the caption changed. */
  setCaption(text: string): boolean;
  setRisk(text: string | null, on: boolean): void;
}

export function filmstrip(p: FilmstripProps): Filmstrip {
  const play = button({ label: "▶", kind: "icon", id: "play", className: "play", onClick: p.onPlay });
  const thumbs = el("div", { id: "thumbs" });
  const next = el("a", { id: "next-chip", className: "next-chip", hidden: true });
  const caption = el("p", { id: "caption" });
  const risk = el("p", { id: "risk" });
  let stops: number[] = [], last = 0;

  /** Time under a point of the strip: each thumbnail spans from its stop to the next. */
  function timeAt(x: number): number | null {
    for (const [i, item] of Array.from(thumbs.querySelectorAll<HTMLElement>(".thumb")).entries()) {
      const r = item.getBoundingClientRect();
      if (x >= r.left && x <= r.right) {
        const from = stops[i], to = stops[i + 1] ?? last;
        return from + ((x - r.left) / r.width) * (to - from);
      }
    }
    return null;
  }
  let scrubbing = false;
  thumbs.addEventListener("pointerdown", (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>(".thumb");
    if (!item) return;
    scrubbing = true;
    thumbs.setPointerCapture(e.pointerId);
    p.onPick(+item.dataset.i!);
  });
  thumbs.addEventListener("pointermove", (e) => {
    if (!scrubbing) return;
    const time = timeAt(e.clientX);
    if (time !== null) p.onScrub(time);
  });
  const endScrub = () => { scrubbing = false; };
  thumbs.addEventListener("pointerup", endScrub);
  thumbs.addEventListener("pointercancel", endScrub);

  return {
    element: el("div", { className: "player" }, risk, caption, el("div", { className: "strip glass" }, play, thumbs, next)),
    play,
    thumbs,
    setSteps(s, images, l) {
      stops = s;
      last = l;
      thumbs.replaceChildren(...s.map((_, i) => thumb(i, images[i])));
    },
    setNext(n) {
      next.hidden = !n;
      if (!n) return;
      next.href = n.href;
      next.onclick = n.onClick;
      next.replaceChildren(el("span", {}, `${n.label} →`), el("b", {}, n.title));
      if (n.more) {
        const more = el("span", { className: "muted", style: "cursor:pointer" }, n.more);
        more.onclick = (e) => { e.preventDefault(); e.stopPropagation(); n.onMore(); };
        next.append(more);
      }
    },
    setTime(time, playing, labels) {
      const i = Math.max(0, stops.findLastIndex((s) => s <= time + 1e-3));
      thumbs.querySelectorAll<HTMLElement>(".thumb").forEach((item, k) => {
        item.classList.toggle("now", k === i);
        const from = stops[k], to = stops[k + 1] ?? last;
        const fill = item.querySelector<HTMLElement>(".fill")!;
        fill.style.width = k === i && to > from ? `${Math.min(1, (time - from) / (to - from)) * 100}%` : k < i ? "100%" : "0";
      });
      play.textContent = playing ? "❚❚" : "▶";
      play.title = playing ? labels.pause : labels.play;
    },
    setCaption(text) {
      if (caption.textContent === text) return false;
      caption.textContent = text;
      return true;
    },
    setRisk(text, on) {
      if (text !== null) risk.textContent = text;
      risk.classList.toggle("on", on);
    },
  };
}
