// Molecule: one row of the panel's lists: a picture of where it ends, the name, the
// submission badge, a line saying what it is. A row that continues the fight shows →.
import { kindBadge } from "../atoms/badge.ts";
import { el } from "../dom.ts";

export interface RefRowProps {
  href: string;
  title: string;
  picture: HTMLElement;
  kind?: string | null;
  sub?: string;
  /** Continues from where the current move ends. */
  chain?: boolean;
  /** It is what is on screen. */
  here?: boolean;
  onClick?: () => void;
}

export function refRow(p: RefRowProps): HTMLLIElement {
  const a = el("a", { href: p.href },
    el("span", { className: "pic" }, p.picture),
    el("span", { className: "text" },
      el("span", { className: "main" }, p.title, p.chain ? el("span", { className: "go" }, "→") : null),
      p.kind ? kindBadge(p.kind) : null,
      p.sub ? el("span", { className: "sub" }, p.sub) : null));
  if (p.here) a.classList.add("here");
  if (p.onClick) a.onclick = p.onClick;
  return el("li", {}, a);
}

/** A list of rows. */
export const refList = (rows: HTMLLIElement[], className = "rows"): HTMLUListElement => el("ul", { className }, ...rows);
