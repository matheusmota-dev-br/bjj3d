import type { Meta, StoryObj } from "@storybook/html-vite";
import { segmented } from "@bjj3d/ui";
import { box, row } from "../support/box.ts";

/** A row of buttons where one is chosen. Click: the state lives in the story. */
const meta: Meta<{ items: [string, string][]; glass: boolean }> = {
  title: "Molecules/Interface/Segmented",
  render: ({ items, glass }) => {
    let value = items[0][0];
    const s = segmented({ items, get: () => value, set: (v) => { value = v; s.refresh(); }, className: glass ? "glass" : undefined });
    return box(110, [row(s.element)], { stage: false });
  },
};
export default meta;
type Story = StoryObj<{ items: [string, string][]; glass: boolean }>;

export const Look: Story = { args: { items: [["solid", "Solid"], ["wood", "Wood"], ["hologram", "X-ray"]], glass: false } };
export const Speed: Story = { args: { items: [["0.25", "¼×"], ["0.5", "½×"], ["1", "1×"]], glass: false } };
/** Over the view, on glass: the camera chip. */
export const CameraChip: Story = { args: { items: [["directed", "Directed"], ["free", "Free"]], glass: true } };
