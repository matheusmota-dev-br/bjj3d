// Organism: the settings behind ⚙: labelled rows of choices, the options, and a row of
// actions. It closes on a click anywhere else.
import { button } from "../atoms/button.ts";
import { el } from "../dom.ts";

export interface SettingsProps {
  title: string;
  /** Each row: an id (the label gets `<id>-label`), its label, and its control. */
  rows: { id: string; label: string; control: HTMLElement }[];
  options: HTMLElement[];
  actions: HTMLElement[];
}

export interface Settings { button: HTMLButtonElement; panel: HTMLDivElement; actions: HTMLDivElement; close(): void }

export function settingsMenu(p: SettingsProps): Settings {
  const actions = el("div", { className: "row actions" }, ...p.actions);
  const panel = el("div", { id: "settings", className: "popover settings", hidden: true },
    ...p.rows.map((r) => el("div", { className: "row" }, el("span", { className: "label", id: `${r.id}-label` }, r.label), r.control)),
    el("div", { id: "options" }, ...p.options),
    actions);
  const btn = button({ label: "⚙", kind: "float", id: "settings-btn", title: p.title });
  btn.setAttribute("aria-expanded", "false");
  const close = () => { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  btn.onclick = () => { panel.hidden = !panel.hidden; btn.setAttribute("aria-expanded", String(!panel.hidden)); };
  addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target as Node) && !btn.contains(e.target as Node)) close();
  });
  return { button: btn, panel, actions, close };
}
