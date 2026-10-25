// The manager: the theme, and a panel with the submission reading at the current frame
// (what someone calibrating a new submission watches).
import { createElement as h } from "react";
import { addons, types, useChannel } from "storybook/manager-api";
import { useState } from "react";
import theme from "./theme.ts";
import { READING } from "../stories/support/channel.ts";

addons.setConfig({ theme });

interface Shown { kind: string; time: number; value: number; danger: boolean; measure: number; unit: string; threshold: string }

function ReadingPanel() {
  const [shown, setShown] = useState<Shown | null>(null);
  useChannel({ [READING]: (r: Shown | null) => setShown(r) });
  const row = (label: string, value: string, strong = false) =>
    h("tr", {}, h("td", { style: { color: "#93a6bd", paddingRight: 16 } }, label), h("td", { style: { fontWeight: strong ? 700 : 400 } }, value));
  if (!shown) return h("p", { style: { padding: 16, color: "#93a6bd" } }, "No submission on screen.");
  return h("table", { style: { margin: 16, fontSize: 14 } }, h("tbody", {},
    row("kind", shown.kind),
    row("frame", shown.time.toFixed(2)),
    row("value", shown.value.toFixed(2)),
    row("measure", `${shown.measure.toFixed(shown.unit === "m" ? 3 : 1)} ${shown.unit === "m" ? "m" : "°"}`),
    row("danger from", shown.threshold),
    row("in danger", shown.danger ? "yes" : "no", shown.danger),
  ));
}

addons.register("bjj3d/reading", () => {
  addons.add("bjj3d/reading/panel", {
    type: types.PANEL,
    title: "Reading",
    render: ({ active }) => (active ? h(ReadingPanel) : null),
  });
});
