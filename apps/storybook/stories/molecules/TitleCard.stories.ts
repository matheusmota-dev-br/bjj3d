import type { Meta, StoryObj } from "@storybook/html-vite";
import { el, titleCard } from "@bjj3d/ui";
import { box } from "../support/box.ts";

type Args = { kind: string; title: string; ends: string };
const meta: Meta<Args> = {
  title: "Molecules/Interface/Title card",
  args: { kind: "Elbow lock", title: "Armbar from knee on belly", ends: "Move · from knee on belly vs underhook to arm bar w/ single leg over" },
  render: (args) => {
    const c = titleCard();
    c.set(args);
    return box(140, [el("div", { className: "top-left" }, c.element)]);
  },
};
export default meta;

export const Move: StoryObj<Args> = {};
export const Position: StoryObj<Args> = { args: { kind: "", title: "closed guard", ends: "Position" } };
