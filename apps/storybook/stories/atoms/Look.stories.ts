import type { Meta, StoryObj } from "@storybook/html-vite";
import { LOOKS } from "@bjj3d/three";
import { play, stage } from "../support/stage.ts";

/** How the mannequins look. A new look is a `LookDef` passed to the viewer (see the guide). */
const meta: Meta<{ look: string }> = {
  title: "Atoms/3D/Look",
  argTypes: { look: { control: "inline-radio", options: LOOKS } },
  render: ({ look }, { globals }) => stage({
    globals: { ...globals, look },
    setup: (v, db) => play(v, db, { type: "p", i: 0 }),
  }),
};
export default meta;

export const Solid: StoryObj<{ look: string }> = { args: { look: "solid" } };
export const Wood: StoryObj<{ look: string }> = { args: { look: "wood" } };
export const XRay: StoryObj<{ look: string }> = { name: "X-ray", args: { look: "hologram" } };
