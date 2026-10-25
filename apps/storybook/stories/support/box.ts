// A box that stands in for the site's page, for the interface stories: the organisms are
// positioned against the page (absolute, fixed), and inside a box they sit where they do
// on the site. `stage` adds the site's #stage, which most of them live in.
import { el } from "@bjj3d/ui";

export function box(height: number, children: HTMLElement[], options: { stage?: boolean; open?: boolean } = {}): HTMLElement {
  const inner = options.stage === false ? children : [el("main", { id: "stage" }, ...children)];
  return el("div", { className: `sb-box${options.open ? " sb-open" : ""}`, style: `height:${height}px` }, ...inner);
}

/** A row of small things side by side. */
export const row = (...children: HTMLElement[]) => el("div", { className: "sb-row" }, ...children);

/** A column on the panel's background, as in the side panel. */
export const column = (...children: HTMLElement[]) => el("div", { className: "sb-col" }, ...children);

/** A placeholder picture (where a real frame of the move goes). */
export function picture(label = ""): HTMLImageElement {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="352" height="198"><rect width="352" height="198" fill="#24477a"/><text x="176" y="105" fill="#cfe0ff" font-family="sans-serif" font-size="16" text-anchor="middle">${label}</text></svg>`;
  return el("img", { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt: "", draggable: false });
}
