import type { Meta, StoryObj } from "@storybook/html-vite";
import { button, el, optionChoice, optionToggle, segmented, settingsMenu } from "@bjj3d/ui";
import { box } from "../support/box.ts";

const meta: Meta = { title: "Organisms/Interface/Settings" };
export default meta;

function seg(items: [string, string][]) {
  let v = items[0][0];
  const s = segmented({ items, get: () => v, set: (x) => { v = x; s.refresh(); } });
  return s.element;
}

/** Open, as after ⚙: look, place, camera, speed, the options and the actions. */
export const Open: StoryObj = {
  render: () => {
    let loop = false, show = "both";
    const s = settingsMenu({
      title: "Settings",
      rows: [
        { id: "look", label: "Look", control: seg([["solid", "Solid"], ["wood", "Wood"], ["hologram", "X-ray"]]) },
        { id: "place", label: "Place", control: seg([["mat", "Mat"], ["gym", "Gym"], ["studio", "Studio"], ["night", "Night"]]) },
        { id: "camera", label: "Camera", control: seg([["directed", "Directed"], ["free", "Free"], ["side", "Side"], ["top", "Top"], ["eyes", "Eyes"]]) },
        { id: "speed", label: "Speed", control: seg([["0.25", "¼×"], ["0.5", "½×"], ["1", "1×"]]) },
      ],
      options: [
        optionToggle({ label: "Loop", hint: "Play the move again when it ends.", get: () => loop, set: (v) => { loop = v; } }).element,
        optionChoice({ label: "Show", hint: "Hide one fighter to see the other's body.", items: [["both", "Both"], ["0", "Amber"], ["1", "Blue"]], get: () => show, set: (v) => { show = v; } }).element,
      ],
      actions: [button({ label: "🧍 Fighters" }), button({ label: "?", round: true })],
    });
    s.panel.hidden = false;
    s.button.setAttribute("aria-expanded", "true");
    return box(620, [el("div", { className: "top-right" }, s.button, s.panel)]);
  },
};
