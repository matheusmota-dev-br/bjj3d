import type { Meta, StoryObj } from "@storybook/html-vite";
import { BELTS } from "@bjj3d/three";
import { play, stage } from "../support/stage.ts";

/** A belt is a colour by id; more can be given to the viewer (`belts` option). */
const meta: Meta<{ belt: string }> = {
  title: "Atoms/3D/Belt",
  argTypes: { belt: { control: "inline-radio", options: BELTS } },
  args: { belt: "black" },
  render: ({ belt }, { globals }) => stage({
    globals,
    setup: (v, db) => {
      play(v, db, { type: "p", i: 0 });
      v.setStyle(0, { build: 1, belt });
      v.setStyle(1, { build: 1, belt });
    },
  }),
};
export default meta;

export const Belt: StoryObj<{ belt: string }> = {};

/** A belt that is not built in: coral, given as a colour. */
export const Custom: StoryObj<{ belt: string }> = {
  args: { belt: "coral" },
  render: ({ belt }, { globals }) => stage({
    globals,
    viewer: { belts: { coral: "#e8735a" } },
    setup: (v, db) => {
      play(v, db, { type: "p", i: 0 });
      v.setStyle(0, { build: 1, belt });
    },
  }),
};
