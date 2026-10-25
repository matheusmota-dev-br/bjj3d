import type { Meta, StoryObj } from "@storybook/html-vite";
import { ARMBAR } from "../support/db.ts";
import { play, stage } from "../support/stage.ts";

interface Args { transition: number; speed: number; loop: boolean; mirrored: boolean; impact: boolean }

/**
 * The whole viewer, as a page that embeds it would use it:
 *
 * ```ts
 * import { Db } from "@bjj3d/data";
 * import { Viewer } from "@bjj3d/three";
 *
 * const db = await Db.load("graph.json");
 * const viewer = new Viewer(canvas);
 * const ref = { type: "t", i: 458, reversed: false } as const;
 * viewer.show({ poses: db.poses(ref), substeps: db.file.substeps, kind: db.file.transitions[458].kind, chain: false });
 * viewer.playing = true;
 * // …
 * viewer.dispose();
 * ```
 */
const meta: Meta<Args> = {
  title: "Templates/Viewer",
  argTypes: {
    transition: { control: { type: "number", min: 0, max: 1484 } },
    speed: { control: { type: "range", min: 0.125, max: 2, step: 0.125 } },
  },
  args: { transition: ARMBAR.i, speed: 1, loop: true, mirrored: false, impact: true },
  render: (args, { globals }) => stage({
    globals,
    height: 560,
    report: true,
    setup: (v, db) => {
      play(v, db, { type: "t", i: args.transition, reversed: false });
      Object.assign(v, { speed: args.speed, loop: args.loop, impactEffect: args.impact });
      v.setMirrored(args.mirrored);
    },
  }),
};
export default meta;

export const Viewer: StoryObj<Args> = {};
export const Mirrored: StoryObj<Args> = { args: { mirrored: true } };
export const SlowMotion: StoryObj<Args> = { args: { speed: 0.25 } };
