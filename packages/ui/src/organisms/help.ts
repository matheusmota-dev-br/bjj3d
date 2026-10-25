// Organism: "how to use", shown on the first visit: a title, numbered steps, a link to the
// demo video and one button.
import { button } from "../atoms/button.ts";
import { el } from "../dom.ts";

export function helpDialog(p: { title: string; steps: string[]; video: { label: string; href: string }; ok: string; onOk: () => void; hidden?: boolean }): HTMLDivElement {
  return el("div", { id: "help", className: "help", hidden: p.hidden ?? false },
    el("h2", { id: "help-title" }, p.title),
    el("ol", { id: "help-steps" }, ...p.steps.map((s) => el("li", {}, s))),
    el("p", { className: "help-video" }, el("a", { id: "help-video", href: p.video.href, target: "_blank", rel: "noopener" }, p.video.label)),
    button({ label: p.ok, kind: "primary", id: "help-ok", onClick: p.onOk }));
}
