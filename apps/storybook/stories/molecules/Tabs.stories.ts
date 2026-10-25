import type { Meta, StoryObj } from "@storybook/html-vite";
import { COLORS } from "@bjj3d/three";
import { tabs } from "@bjj3d/ui";
import { column } from "../support/box.ts";

const meta: Meta = { title: "Molecules/Interface/Tabs" };
export default meta;

function live<V>(items: { value: V; label: string; color?: string }[]) {
  const wrap = column();
  const draw = (value: V) => wrap.replaceChildren(tabs({ items, value, onPick: draw }));
  draw(items[0].value);
  return wrap;
}

/** The panel's lists. */
export const Lists: StoryObj = { render: () => live([{ value: "techniques", label: "Techniques" }, { value: "submissions", label: "Finishes" }, { value: "positions", label: "Positions" }]) };
/** The fighters screen: one tab per fighter, with its colour. */
export const Fighters: StoryObj = { render: () => live([{ value: 0, label: "Amber", color: COLORS[0] }, { value: 1, label: "Blue", color: COLORS[1] }]) };
