import type { Meta, StoryObj } from "@storybook/html-vite";

/**
 * The site's screens, from its production build (served at /site/; run `pnpm build`
 * before `pnpm storybook`). Each page is the real app at an address.
 */
const meta: Meta<{ address: string }> = {
  title: "Pages/Site",
  render: ({ address }) => {
    const frame = document.createElement("iframe");
    frame.className = "sb-frame";
    frame.src = `./site/index.html${address}`;
    frame.title = "bjj3d";
    return frame;
  },
};
export default meta;

/** What a first-time visitor sees: the armbar and the short "how to use". */
export const FirstVisit: StoryObj<{ address: string }> = { args: { address: "" } };
/** A fight paused at a keyframe, from a shared link. */
export const SharedLink: StoryObj<{ address: string }> = { args: { address: "?frame=6#t/458" } };
/** A position, with the moves that start from it. */
export const Position: StoryObj<{ address: string }> = { args: { address: "#p/0" } };
