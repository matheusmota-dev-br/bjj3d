import type { Meta, StoryObj } from "@storybook/html-vite";
import { finishes, loadDb } from "../support/db.ts";
import { play, stage } from "../support/stage.ts";

/**
 * Every finishing transition in the database, each at its last frame. Only the stages on
 * screen hold a WebGL context; scroll and they come and go.
 */
const meta: Meta = { title: "Engine/Finishes", parameters: { layout: "padded" } };
export default meta;

export const Gallery: StoryObj = {
  loaders: [async () => ({ refs: await finishes(), db: await loadDb() })],
  render: (_, { globals, loaded }) => {
    const grid = document.createElement("div");
    grid.className = "sb-grid";
    for (const ref of loaded.refs) {
      const t = loaded.db.file.transitions[ref.i];
      grid.append(stage({
        globals,
        height: 220,
        label: `${t.kind} · ${t.name} (line ${t.line})`,
        setup: (v, db) => { play(v, db, ref, 0); v.time = v.last; },
      }));
    }
    return grid;
  },
};
