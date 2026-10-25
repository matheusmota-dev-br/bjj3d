import type { Meta, StoryObj } from "@storybook/html-vite";
import { el, thumb } from "@bjj3d/ui";
import { box, picture } from "../support/box.ts";

/** A cell of the filmstrip, playing (`now`) and half-filled. */
const meta: Meta<{ step: number; fill: number; now: boolean }> = {
  title: "Molecules/Interface/Thumb",
  argTypes: { fill: { control: { type: "range", min: 0, max: 100 } } },
  args: { step: 2, fill: 45, now: true },
  render: ({ step, fill, now }) => {
    const t = thumb(step, picture(`step ${step + 1}`).src);
    t.classList.toggle("now", now);
    t.querySelector<HTMLElement>(".fill")!.style.width = `${fill}%`;
    return box(150, [el("div", { className: "player", style: "bottom:20px" }, el("div", { className: "strip glass" }, el("div", { id: "thumbs" }, t)))]);
  },
};
export default meta;

export const Thumb: StoryObj<{ step: number; fill: number; now: boolean }> = {};
