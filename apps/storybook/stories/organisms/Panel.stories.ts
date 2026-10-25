import type { Meta, StoryObj } from "@storybook/html-vite";
import { action } from "storybook/actions";
import { COLORS } from "@bjj3d/three";
import { eyebrow, nowCard, panel, refList, refRow, tabs } from "@bjj3d/ui";
import { box, picture } from "../support/box.ts";

const meta: Meta = { title: "Organisms/Interface/Panel" };
export default meta;

/** Open, as after "Browse": what is on screen, the next moves and the lists. */
export const Open: StoryObj = {
  render: () => {
    const p = panel({
      icon: "favicon.svg", name: "bjj3d", searchPlaceholder: "Search: mount, armbar, guard…",
      about: "Motion from GrappleMap, schematic and no-gi. The load on the joints is estimated from geometry only.",
      languages: [{ value: "en", label: "English" }, { value: "pt-BR", label: "Português (Brasil)" }], language: "en", languageTitle: "Language",
      onSearch: action("search"), onLanguage: action("language"), onTheme: action("theme"), onClose: action("close"),
    });
    p.setTheme("☾", "Theme: dark");
    p.body.append(
      eyebrow("Now"),
      nowCard({ kind: "Elbow lock", title: "Armbar from knee on belly", what: "Move · from knee on belly to arm bar", mover: { color: COLORS[0], text: "Amber moves" } }),
      eyebrow("Next"),
      refList([refRow({ href: "#", title: "arm bar w/ single leg over", picture: picture("next"), chain: true, sub: "Move · from arm bar to tap" })], "rows moves"),
      eyebrow("Explore"),
      tabs({ items: [{ value: "t", label: "Techniques" }, { value: "s", label: "Finishes" }, { value: "p", label: "Positions" }], value: "t", onPick: () => {} }),
      refList([refRow({ href: "#", title: "Armbar setup from closed guard", picture: picture("end"), kind: "Elbow lock" })]),
    );
    return box(700, [p.element], { stage: false, open: true });
  },
};
