import type { Meta, StoryObj } from "@storybook/html-vite";
import { BELT_COLORS, COLORS, TENSION_COLOR } from "@bjj3d/three";

const meta: Meta = { title: "Foundations/Tokens", parameters: { layout: "padded" } };
export default meta;

function swatches(entries: [string, string][]) {
  const grid = document.createElement("div");
  grid.className = "sb-grid";
  for (const [name, value] of entries) {
    const s = document.createElement("div");
    s.className = "sb-swatch";
    s.innerHTML = `<i style="background:${value}"></i><div><div>${name}</div><code>${value}</code></div>`;
    grid.append(s);
  }
  return grid;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const INTERFACE = ["--navy", "--panel", "--card", "--hover", "--ink", "--muted", "--line", "--amber", "--blue", "--tension"];

/** The two fighters keep their colours for as long as a chain of transitions goes on. */
export const Fighters: StoryObj = { render: () => swatches([["amber (player 0)", COLORS[0]], ["blue (player 1)", COLORS[1]], ["tension glow", `#${TENSION_COLOR.getHexString()}`]]) };

export const Belts: StoryObj = { render: () => swatches(Object.entries(BELT_COLORS)) };

/** The interface colours, as CSS custom properties; switch the theme in the toolbar. */
export const Interface: StoryObj = { render: () => swatches(INTERFACE.map((n) => [n, css(n)])) };
