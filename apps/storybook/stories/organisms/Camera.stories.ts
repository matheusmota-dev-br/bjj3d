import type { Meta, StoryObj } from "@storybook/html-vite";
import type { CameraMode } from "@bjj3d/three";
import { ARMBAR } from "../support/db.ts";
import { play, stage } from "../support/stage.ts";

const MODES: CameraMode[] = ["directed", "free", "side", "top", "eyes0", "eyes1"];

/**
 * Directed: for each keyframe, the angle that keeps the attacked joint in sight and the
 * bodies side by side, gliding between them. The others are fixed or free.
 */
const meta: Meta<{ mode: CameraMode }> = {
  title: "Organisms/3D/Camera",
  argTypes: { mode: { control: "select", options: MODES } },
  args: { mode: "directed" },
  render: ({ mode }, { globals }) => stage({ globals, setup: (v, db) => { play(v, db, ARMBAR); v.setCamera(mode); } }),
};
export default meta;

export const Directed: StoryObj<{ mode: CameraMode }> = {};
export const Side: StoryObj<{ mode: CameraMode }> = { args: { mode: "side" } };
export const Top: StoryObj<{ mode: CameraMode }> = { args: { mode: "top" } };
export const ThroughTheEyes: StoryObj<{ mode: CameraMode }> = { args: { mode: "eyes1" } };
