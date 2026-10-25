import type { Meta, StoryObj } from "@storybook/html-vite";
import { action } from "storybook/actions";
import { BELT_COLORS, BELTS, COLORS } from "@bjj3d/three";
import { button, customizer, el, slider, swatchChoices, tabs } from "@bjj3d/ui";
import { box } from "../support/box.ts";

const meta: Meta = { title: "Organisms/Interface/Customizer" };
export default meta;

/** The fighters screen's drawer, filled as the site fills it. */
export const Open: StoryObj = {
  render: () => {
    const c = customizer({ title: "Customize the fighters", done: "Done", onDone: action("done") });
    c.element.hidden = false;
    c.tabs.replaceWith(tabs({ id: "cz-tabs", items: [{ value: 0, label: "Amber", color: COLORS[0] }, { value: 1, label: "Blue", color: COLORS[1] }], value: 0, onPick: action("fighter") }));
    c.body.append(
      el("h3", {}, "Body"),
      slider({ label: "Thickness", min: 0.85, max: 1.2, step: 0.01, value: 1, ends: ["Slim", "Sturdy"], onInput: action("build") }),
      el("h3", {}, "Belt"),
      swatchChoices({ items: BELTS.map((b) => ({ value: b, label: b, color: BELT_COLORS[b] })), value: "white", onPick: action("belt") }),
      el("div", { className: "cz-actions" }, button({ label: "Reset" })),
      el("p", { className: "muted" }, "The contact solver is tuned to the standard build; a much sturdier one may overlap a little more."),
    );
    return box(620, [c.element]);
  },
};
