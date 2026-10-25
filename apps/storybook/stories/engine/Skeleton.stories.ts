import type { Meta, StoryObj } from "@storybook/html-vite";
import { JOINTS } from "@bjj3d/core";
import { play, stage } from "../support/stage.ts";

/**
 * The skeleton every package depends on: GrappleMap's 23 joints per player, two players
 * per pose (index 0 is "top", 1 is "bottom"). Here the stick figure is drawn over the
 * mannequins, as the data is.
 */
const meta: Meta = { title: "Engine/Skeleton" };
export default meta;

export const Joints: StoryObj = {
  render: (_, { globals }) => {
    const wrap = document.createElement("div");
    wrap.append(stage({ globals: { ...globals, look: "hologram" }, setup: (v, db) => { play(v, db, { type: "p", i: 0 }); v.showSticks(true); } }));
    const list = document.createElement("p");
    list.className = "sb-page muted";
    list.textContent = JOINTS.join(" · ");
    wrap.append(list);
    return wrap;
  },
};
