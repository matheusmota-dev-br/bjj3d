import type { Meta, StoryObj } from "@storybook/html-vite";
import { action } from "storybook/actions";
import { button, type ButtonProps } from "@bjj3d/ui";
import { box, row } from "../support/box.ts";

const meta: Meta<ButtonProps> = {
  title: "Atoms/Interface/Button",
  argTypes: { kind: { control: "inline-radio", options: ["chip", "float", "icon", "primary"] } },
  args: { label: "Done", kind: "chip", round: false, onClick: action("click") },
  render: (args) => box(120, [row(button(args))], { stage: false }),
};
export default meta;
type Story = StoryObj<ButtonProps>;

export const Chip: Story = {};
export const Round: Story = { args: { label: "?", round: true } };
export const Float: Story = { args: { label: "☰ Browse", kind: "float" } };
export const Icon: Story = { args: { label: "▶", kind: "icon", className: "play" } };
export const Primary: Story = { args: { label: "Got it", kind: "primary" } };
export const Pressed: Story = { args: { label: "Wood", pressed: true } };

/** All four kinds together, as they appear around the view. */
export const All: Story = {
  render: () => box(120, [row(
    button({ label: "☰ Browse", kind: "float" }), button({ label: "⚙", kind: "float" }), button({ label: "▶", kind: "icon", className: "play" }),
    button({ label: "🧍 Fighters" }), button({ label: "?", round: true }), button({ label: "Got it", kind: "primary" }),
  )], { stage: false }),
};
