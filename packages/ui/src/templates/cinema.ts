// Template: the cinema screen. The move fills the page; everything else floats over it:
// top left the menu and what is on screen, top right the camera chip and ⚙, the overlays
// (vignette, Oss!, the ring, the fighters drawer, how to use), the player at the bottom,
// and the panel that slides in from the side. It only places the organisms it is given.
import { button } from "../atoms/button.ts";
import { el } from "../dom.ts";

export interface CinemaParts {
  panel: HTMLElement;
  menuLabel: string;
  onMenu: () => void;
  titleCard: HTMLElement;
  camChip: HTMLElement;
  settingsButton: HTMLElement;
  settings: HTMLElement;
  oss: HTMLElement;
  attention: HTMLElement;
  customizer: HTMLElement;
  help: HTMLElement;
  player: HTMLElement;
}

export interface Cinema { stage: HTMLElement; canvas: HTMLCanvasElement; nodes: HTMLElement[] }

export function cinema(p: CinemaParts): Cinema {
  const canvas = el("canvas", { id: "view" });
  const stage = el("main", { id: "stage" },
    canvas,
    el("div", { className: "top-left" }, button({ label: p.menuLabel, kind: "float", id: "menu", onClick: p.onMenu }), p.titleCard),
    el("div", { className: "top-right" }, p.camChip, p.settingsButton, p.settings),
    el("div", { id: "vignette" }),
    p.oss,
    p.attention,
    p.customizer,
    p.help,
    p.player);
  return { stage, canvas, nodes: [p.panel, stage] };
}
