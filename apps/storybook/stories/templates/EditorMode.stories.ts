import type { Meta, StoryObj } from "@storybook/html-vite";
import { openEditor } from "@bjj3d/editor";
import { el } from "@bjj3d/ui";
import { sampleCinema } from "../support/cinema.ts";
import { inMemoryEditorServer } from "../support/editor-server.ts";
import { ARMBAR } from "../support/db.ts";
import { play, stage } from "../support/stage.ts";

/**
 * The local editor, the site's mode for writing new positions and transitions: its drawer
 * over the cinema screen, posing both mannequins by their joints. In the site it exists only
 * on the dev server; here its two endpoints are answered in memory, so saving works and
 * writes nothing.
 */
const meta: Meta<{ lang: string }> = {
  title: "Templates/Editor mode",
  argTypes: { lang: { control: "inline-radio", options: ["en", "pt-BR"] } },
  args: { lang: "en" },
  parameters: { docs: { story: { inline: false, height: "720px" } } },
  render: ({ lang }, { globals }) => {
    inMemoryEditorServer();
    const { screen } = sampleCinema();
    screen.nodes[1].querySelector(".player")?.remove();
    const page = el("div", { className: "sb-box", style: "height:720px" }, ...screen.nodes);
    stage({
      globals, element: page, canvas: screen.canvas,
      // As on the site, the editor opens over what is on screen.
      // The editor takes the camera over where it is, so the camera frames the move first.
      setup: (viewer, db) => {
        play(viewer, db, ARMBAR, 0);
        // A couple of seconds of the directed camera, paused, as on the site before ✎.
        for (let i = 0; i < 60; i++) viewer.step(0.05);
        openEditor({ viewer, db, lang: () => lang, onClose: () => {} });
      },
    });
    return page;
  },
};
export default meta;

export const Editor: StoryObj<{ lang: string }> = {};
export const Portuguese: StoryObj<{ lang: string }> = { args: { lang: "pt-BR" } };
