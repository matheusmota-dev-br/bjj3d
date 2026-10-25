import type { Meta, StoryObj } from "@storybook/html-vite";
import { refList, refRow, type RefRowProps } from "@bjj3d/ui";
import { column, picture } from "../support/box.ts";

type Args = Omit<RefRowProps, "picture">;
const meta: Meta<Args> = {
  title: "Molecules/Interface/Ref row",
  args: { href: "#t/458", title: "Armbar from knee on belly", kind: "Elbow lock", sub: "Move · from knee on belly to arm bar", chain: false, here: false },
  render: (args) => column(refList([refRow({ ...args, picture: picture("end") })])),
};
export default meta;
type Story = StoryObj<Args>;

export const Finish: Story = {};
export const Position: Story = { args: { title: "closed guard", kind: null, sub: undefined, href: "#p/0" } };
/** In "Next": it continues from where the current move ends. */
export const Next: Story = { args: { chain: true, kind: null, title: "arm bar w/ single leg over" } };
/** What is on screen is marked. */
export const Here: Story = { args: { here: true } };
