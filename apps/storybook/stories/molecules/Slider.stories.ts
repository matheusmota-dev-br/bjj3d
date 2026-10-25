import type { Meta, StoryObj } from "@storybook/html-vite";
import { action } from "storybook/actions";
import { BELT_COLORS, BELTS } from "@bjj3d/three";
import { slider, swatchChoices } from "@bjj3d/ui";
import { column } from "../support/box.ts";

const meta: Meta = { title: "Molecules/Interface/Slider and swatch choices" };
export default meta;

export const Build: StoryObj = {
  render: () => column(slider({ label: "Thickness", min: 0.85, max: 1.2, step: 0.01, value: 1, ends: ["Slim", "Sturdy"], onInput: action("input") })),
};

export const Belts: StoryObj = {
  render: () => {
    const wrap = column();
    const draw = (value: string) => wrap.replaceChildren(swatchChoices({ items: BELTS.map((b) => ({ value: b, label: b, color: BELT_COLORS[b] })), value, onPick: draw }));
    draw("white");
    return wrap;
  },
};
