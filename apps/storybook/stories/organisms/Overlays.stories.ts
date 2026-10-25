import type { Meta, StoryObj } from "@storybook/html-vite";
import { action } from "storybook/actions";
import { attention, button, el, helpDialog, oss } from "@bjj3d/ui";
import { box } from "../support/box.ts";

const meta: Meta = { title: "Organisms/Interface/Overlays" };
export default meta;

export const HowToUse: StoryObj = {
  render: () => box(420, [helpDialog({
    title: "How to use",
    steps: ["Pick a technique, finish or position in the panel.", "Press ▶ to watch. Drag to turn the camera.", "Then pick the next move to go on, as in training.", "In a finish, the attacked joint turns red when it can injure."],
    ok: "Got it", onOk: action("ok"),
  })]),
};

/** Oss!: press the button to greet again. */
export const Oss: StoryObj = {
  render: () => {
    const o = oss();
    const again = button({ label: "Oss again", onClick: () => o.start(1050, action("done")) });
    o.start(1050, action("done"));
    return box(420, [o.element, el("div", { style: "position:absolute;left:12px;top:12px" }, again)]);
  },
};

type Ring = { hot: boolean; degrees: boolean };
/** The ring on the attacked joint; hot at the finishing moment, with the angle as an option. */
export const AttackedJointRing: StoryObj<Ring> = {
  args: { hot: false, degrees: true },
  render: ({ hot, degrees }) => {
    const a = attention();
    const b = box(300, [a.element]);
    a.set({ x: 300, y: 150 }, hot, degrees ? "12°" : null);
    const stage = b.querySelector<HTMLElement>("#stage")!;
    if (hot) stage.style.setProperty("--impact", "0.8");
    b.onclick = () => a.pulse(stage, { x: 300, y: 150 });
    return b;
  },
};
