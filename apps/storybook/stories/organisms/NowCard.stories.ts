import type { Meta, StoryObj } from "@storybook/html-vite";
import { action } from "storybook/actions";
import { COLORS } from "@bjj3d/three";
import { nowCard } from "@bjj3d/ui";
import { column } from "../support/box.ts";

const meta: Meta = { title: "Organisms/Interface/Now card" };
export default meta;

/** A reviewed technique: who moves, its steps (click to jump), a note. */
export const Technique: StoryObj = {
  render: () => column(nowCard({
    kind: "Elbow lock", title: "Armbar from knee on belly", what: "Move · from knee on belly vs underhook to arm bar",
    mover: { color: COLORS[0], text: "Amber moves" },
    steps: ["Knee on belly; the opponent pushes with the near arm.", "Trap the arm, far leg around the head.", "Sit close to the shoulder and fall back.", "Knees together, thumb up, hips up."].map((text) => ({ text, onClick: action("step") })),
    notes: ["Draft text, not reviewed yet."],
  })),
};

export const Position: StoryObj = { render: () => column(nowCard({ title: "closed guard", what: "Position" })) };
