import type { Meta, StoryObj } from "@storybook/html-vite";
import { builtinMetrics } from "@bjj3d/metrics";
import { play, stage } from "../support/stage.ts";

/**
 * Each submission metric over a finish of its kind. The "Reading" panel shows the value,
 * the measure and where the danger range starts; docs/validation.md has the numbers over
 * the whole database.
 */
const meta: Meta<{ kind: string }> = {
  title: "Engine/Metrics",
  argTypes: { kind: { control: "select", options: builtinMetrics.map((m) => m.id) } },
  render: ({ kind }, { globals }) => stage({
    globals,
    report: true,
    setup: (v, db) => {
      const i = db.file.transitions.findIndex((t) => t.kind === kind && /tap|finish/i.test(t.name));
      play(v, db, { type: "t", i: Math.max(0, i), reversed: false });
    },
  }),
};
export default meta;

export const Elbow: StoryObj<{ kind: string }> = { args: { kind: "elbow" } };
export const Shoulder: StoryObj<{ kind: string }> = { args: { kind: "shoulder" } };
export const Knee: StoryObj<{ kind: string }> = { args: { kind: "knee" } };
export const KneeTwist: StoryObj<{ kind: string }> = { args: { kind: "kneeTwist" } };
export const Choke: StoryObj<{ kind: string }> = { args: { kind: "choke" } };
export const NeckCrank: StoryObj<{ kind: string }> = { args: { kind: "neckCrank" } };
