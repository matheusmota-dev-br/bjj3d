import type { Meta, StoryObj } from "@storybook/html-vite";
import { BELTS } from "@bjj3d/three";
import { play, stage } from "../support/stage.ts";

interface Args { build: number; belt: string; sticks: boolean }

/** One fighter: rigid pieces placed straight from GrappleMap's 23 joints, nothing deforms. */
const meta: Meta<Args> = {
  title: "Molecules/3D/Mannequin",
  argTypes: {
    build: { control: { type: "range", min: 0.8, max: 1.2, step: 0.05 } },
    belt: { control: "inline-radio", options: BELTS },
    sticks: { control: "boolean", description: "GrappleMap's stick figure over the mannequin" },
  },
  args: { build: 1, belt: "white", sticks: false },
  render: (args, { globals }) => stage({
    globals,
    setup: (v, db) => {
      play(v, db, { type: "p", i: 0 });
      v.visible = [true, false];
      v.setStyle(0, { build: args.build, belt: args.belt });
      v.showSticks(args.sticks);
    },
  }),
};
export default meta;

export const Mannequin: StoryObj<Args> = {};
export const WithSticks: StoryObj<Args> = { args: { sticks: true } };
