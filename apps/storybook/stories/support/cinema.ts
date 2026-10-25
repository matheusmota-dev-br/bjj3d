// The site's cinema screen with English texts and no page logic: the template filled with
// every organism, for the template and editor stories. The 3D view is drawn by a stage.
import { COLORS } from "@bjj3d/three";
import {
  attention, button, cinema, customizer, filmstrip, helpDialog, nowCard, optionToggle, oss, panel, refList, refRow, segmented, settingsMenu, titleCard,
  eyebrow,
} from "@bjj3d/ui";
import { picture } from "./box.ts";

export function sampleCinema(options: { help?: boolean } = {}) {
  let camera = "directed";
  const cam = segmented({ items: [["directed", "Directed"], ["free", "Free"]], get: () => camera, set: (v) => { camera = v; cam.refresh(); }, id: "camchip", className: "glass" });
  const settings = settingsMenu({
    title: "Settings",
    rows: [
      { id: "look", label: "Look", control: segmented({ items: [["solid", "Solid"], ["wood", "Wood"], ["hologram", "X-ray"]], get: () => "solid", set: () => {} }).element },
      { id: "place", label: "Place", control: segmented({ items: [["mat", "Mat"], ["gym", "Gym"], ["studio", "Studio"], ["night", "Night"]], get: () => "mat", set: () => {} }).element },
    ],
    options: [optionToggle({ label: "Loop", hint: "Play the move again when it ends.", get: () => false, set: () => {} }).element],
    actions: [button({ label: "🧍 Fighters" }), button({ label: "?", round: true })],
  });
  const side = panel({
    icon: "favicon.svg", name: "bjj3d", searchPlaceholder: "Search: mount, armbar, guard…", about: "Motion from GrappleMap.",
    languages: [{ value: "en", label: "English" }], language: "en", languageTitle: "Language",
    onSearch: () => {}, onLanguage: () => {}, onTheme: () => {}, onClose: () => document.body.classList.remove("open"),
  });
  side.setTheme("☾", "Theme: dark");
  side.body.append(
    eyebrow("Now"),
    nowCard({ kind: "Elbow lock", title: "Armbar from knee on belly", what: "Move · from knee on belly to arm bar", mover: { color: COLORS[0], text: "Amber moves" },
      steps: [{ text: "Knee on belly.", onClick: () => {} }, { text: "Trap the arm, leg over the head.", onClick: () => {} }] }),
    eyebrow("Next"),
    refList([refRow({ href: "#", title: "arm bar w/ single leg over", picture: picture("next"), chain: true })], "rows moves"),
  );
  const card = titleCard();
  card.set({ kind: "Elbow lock", title: "Armbar from knee on belly", ends: "Move · from knee on belly vs underhook to arm bar w/ single leg over" });
  const strip = filmstrip({ onPlay: () => {}, onPick: () => {}, onScrub: () => {} });
  strip.setSteps([0, 2, 4, 6], [1, 2, 3, 4].map((n) => picture(`step ${n}`).src), 8);
  strip.setNext({ href: "#", label: "next", title: "arm bar w/ single leg over", onMore: () => {}, onClick: () => {} });
  strip.setCaption("3. Sit close to the shoulder and fall back.");
  const screen = cinema({
    panel: side.element, menuLabel: "☰ Browse", onMenu: () => document.body.classList.toggle("open"),
    titleCard: card.element, camChip: cam.element, settingsButton: settings.button, settings: settings.panel,
    oss: oss().element, attention: attention().element,
    customizer: customizer({ title: "Customize the fighters", done: "Done", onDone: () => {} }).element,
    help: helpDialog({ title: "How to use", steps: ["Pick a technique.", "Press ▶ to watch."], video: { label: "▶ Watch the 60-second demo", href: "https://youtu.be/yeQPuzHseZg" }, ok: "Got it", onOk: () => {}, hidden: !options.help }),
    player: strip.element,
  });
  return { screen, strip };
}
