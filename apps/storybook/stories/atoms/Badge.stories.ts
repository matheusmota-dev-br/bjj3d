import type { Meta, StoryObj } from "@storybook/html-vite";
import { dot, eyebrow, kindBadge, swatch } from "@bjj3d/ui";
import { COLORS } from "@bjj3d/three";
import { box, row } from "../support/box.ts";

const meta: Meta<{ text: string }> = {
  title: "Atoms/Interface/Badge, dot, swatch and eyebrow",
  args: { text: "Elbow lock" },
  render: ({ text }) => box(100, [row(kindBadge(text))], { stage: false }),
};
export default meta;
type Story = StoryObj<{ text: string }>;

export const KindBadge: Story = {};
export const FighterDots: Story = { render: () => box(100, [row(dot(COLORS[0], true), dot(COLORS[1], true))], { stage: false }) };
export const Swatches: Story = { render: () => box(100, [row(swatch("#f2f0ea"), swatch("#2457b8"), swatch("#6a3a9c"), swatch("#6b4226"), swatch("#1a1a1c"))], { stage: false }) };
export const Eyebrow: Story = { args: { text: "Next" }, render: ({ text }) => box(100, [row(eyebrow(text))], { stage: false }) };
