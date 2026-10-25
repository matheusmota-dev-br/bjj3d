import type { Meta, StoryObj } from "@storybook/html-vite";
import { PLACES } from "@bjj3d/three";
import { ARMBAR } from "../support/db.ts";
import { play, stage } from "../support/stage.ts";

/** Two fighters, a place and its lights. A new place is a `PlaceDef` passed to the viewer. */
const meta: Meta<{ place: string }> = {
  title: "Organisms/3D/Scene",
  argTypes: { place: { control: "inline-radio", options: PLACES } },
  render: ({ place }, { globals }) => stage({ globals: { ...globals, place }, setup: (v, db) => play(v, db, ARMBAR) }),
};
export default meta;

export const Mat: StoryObj<{ place: string }> = { args: { place: "mat" } };
export const Gym: StoryObj<{ place: string }> = { args: { place: "gym" } };
export const Studio: StoryObj<{ place: string }> = { args: { place: "studio" } };
export const Night: StoryObj<{ place: string }> = { args: { place: "night" } };
