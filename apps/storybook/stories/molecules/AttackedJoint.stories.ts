import type { Meta, StoryObj } from "@storybook/html-vite";
import { ARMBAR } from "../support/db.ts";
import { play, stage } from "../support/stage.ts";

/**
 * The glow on the attacked joint: red, growing as the lock tightens. Scrub the frame; the
 * "Reading" panel shows the measure behind it.
 */
const meta: Meta<{ frame: number }> = {
  title: "Molecules/3D/Attacked joint",
  argTypes: { frame: { control: { type: "range", min: 0, max: 8, step: 0.05 } } },
  args: { frame: 6 },
  render: ({ frame }, { globals }) => stage({ globals, report: true, setup: (v, db) => play(v, db, ARMBAR, frame) }),
};
export default meta;

export const Armbar: StoryObj<{ frame: number }> = {};
