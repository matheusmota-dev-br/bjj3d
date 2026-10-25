import type { Meta, StoryObj } from "@storybook/html-vite";
import { optionChoice, optionToggle } from "@bjj3d/ui";
import { column } from "../support/box.ts";

const meta: Meta = { title: "Molecules/Interface/Option" };
export default meta;

export const Toggle: StoryObj = {
  render: () => {
    let on = true;
    return column(optionToggle({ label: "Finishing moment", hint: "Slow motion and a push-in when a lock reaches its danger range.", get: () => on, set: (v) => { on = v; } }).element);
  },
};

export const Choice: StoryObj = {
  render: () => {
    let v = "both";
    const o = optionChoice({ label: "Show", hint: "Hide one fighter to see the other's body.", items: [["both", "Both"], ["0", "Amber"], ["1", "Blue"]], get: () => v, set: (x) => { v = x; o.refresh(); } });
    return column(o.element);
  },
};
