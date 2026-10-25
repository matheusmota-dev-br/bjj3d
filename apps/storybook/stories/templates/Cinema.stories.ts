import type { Meta, StoryObj } from "@storybook/html-vite";
import { el } from "@bjj3d/ui";
import { sampleCinema } from "../support/cinema.ts";
import { ARMBAR } from "../support/db.ts";
import { play, stage } from "../support/stage.ts";

/**
 * The cinema screen: the template with every organism in place, a real viewer behind. The
 * buttons do nothing here (the site's logic is in apps/web); ☰ opens the panel.
 */
const meta: Meta<{ help: boolean }> = {
  title: "Templates/Cinema",
  args: { help: false },
  render: ({ help }, { globals }) => {
    const { screen } = sampleCinema({ help });
    const page = el("div", { className: "sb-box", style: "height:680px" }, ...screen.nodes);
    stage({ globals, element: page, canvas: screen.canvas, setup: (v, db) => play(v, db, ARMBAR) });
    return page;
  },
};
export default meta;

export const Cinema: StoryObj<{ help: boolean }> = {};
export const FirstVisit: StoryObj<{ help: boolean }> = { args: { help: true } };
