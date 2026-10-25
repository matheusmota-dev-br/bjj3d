import type { Meta, StoryObj } from "@storybook/html-vite";
import { action } from "storybook/actions";
import { filmstrip } from "@bjj3d/ui";
import { box, picture } from "../support/box.ts";

type Args = { time: number; playing: boolean; danger: boolean };
const meta: Meta<Args> = {
  title: "Organisms/Interface/Filmstrip",
  argTypes: { time: { control: { type: "range", min: 0, max: 8, step: 0.1 } } },
  args: { time: 5, playing: true, danger: true },
  render: ({ time, playing, danger }) => {
    const f = filmstrip({ onPlay: action("play"), onPick: action("pick"), onScrub: action("scrub") });
    f.setSteps([0, 2, 4, 6], [1, 2, 3, 4].map((n) => picture(`step ${n}`).src), 8);
    f.setNext({ href: "#", label: "next", title: "arm bar w/ single leg over", more: "+2 more", onMore: action("more"), onClick: action("next") });
    f.setTime(time, playing, { play: "Play", pause: "Pause" });
    f.setCaption("3. Sit close to the shoulder and fall back.");
    f.setRisk("From here the lock can injure the elbow (hyperextension).", danger);
    return box(260, [f.element]);
  },
};
export default meta;

export const Playing: StoryObj<Args> = {};
export const Paused: StoryObj<Args> = { args: { playing: false, time: 0, danger: false } };
