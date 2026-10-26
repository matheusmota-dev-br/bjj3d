import "@bjj3d/ui/tokens.css";
import "@bjj3d/ui/ui.css";
import { Db, parseRef, refKey, type Ref } from "@bjj3d/data";
import { BELT_COLORS, BELTS, COLORS, Viewer, type BuiltinBelt, type CameraMode, type Look, type Place, type StudioFocus, type Style, type Theme } from "@bjj3d/three";
import {
  attention, button, cinema, customizer as customizerDrawer, el, eyebrow, filmstrip, helpDialog, nowCard as nowCardView,
  optionChoice, optionToggle, oss, panel as panelView, refList, refRow, segmented, settingsMenu, slider, swatchChoices, tabs, titleCard,
} from "@bjj3d/ui";
import { currentLang, kindName, langName, LANGS, measureLabel, pick, risk, setLang, t } from "./i18n.ts";

/** Reloads the page. An object so tests can replace it: location.reload itself cannot be. */
export const page = { reload: location.reload.bind(location) };

// --- settings kept per viewer (they only make the page nicer; it works without them)

type Camera = "directed" | "free" | "side" | "top" | "eyes";
const SETTINGS_KEY = "bjj3d.settings.v2";
/** Where settings were kept while the project was called bjj-3d; read once, never written. */
const OLD_SETTINGS_KEY = "bjj-3d.settings.v2";
const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
const settings = {
  lang: "pt-BR", theme: (prefersDark ? "dark" : "light") as Theme, place: "mat" as Place,
  look: "solid" as Look, camera: "directed" as Camera, eyesOf: "1", speed: 1, show: "both",
  loop: false, mirror: false, degrees: false, impact: true, oss: true, helpSeen: false,
  fighters: [] as Partial<Style>[],
};
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? localStorage.getItem(OLD_SETTINGS_KEY) ?? "{}")); } catch { /* private mode */ }
const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

// --- boot

setLang(settings.lang);
document.documentElement.dataset.theme = settings.theme;
const query = new URLSearchParams(location.search);

// --- the page: the cinema template, filled with the organisms

const refreshers: (() => void)[] = [];
/** A row of buttons where one is chosen; it refreshes with the rest of the settings. */
function seg<V extends string | number>(items: [V, string][], get: () => V, set: (v: V) => void, id?: string, className?: string) {
  const s = segmented({ items, get, set: (v) => { set(v); changed(); }, id, className });
  refreshers.push(s.refresh);
  return s.element;
}
const looks: [Look, string][] = [["solid", t("lookSolid")], ["wood", t("lookWood")], ["hologram", t("lookHologram")]];
// Older saved settings may name a look or camera that no longer exists.
if (!looks.some(([l]) => l === settings.look)) settings.look = "solid";
if (!["directed", "free", "side", "top", "eyes"].includes(settings.camera)) settings.camera = "directed";
const places: [Place, string][] = [["mat", t("envMat")], ["gym", t("envGym")], ["studio", t("envStudio")], ["night", t("envNight")]];
const cameras: [Camera, string][] = [["directed", t("camDirected")], ["free", t("camFree")], ["side", t("camSide")], ["top", t("camTop")], ["eyes", t("camEyes")]];

// Options: each with a line saying what it does.
function toggle(key: "loop" | "mirror" | "degrees" | "impact" | "oss", label: string, hint: string) {
  const o = optionToggle({ label, hint, get: () => settings[key], set: (on) => { settings[key] = on; changed(); } });
  refreshers.push(o.refresh);
  return o.element;
}
function choice(label: string, hint: string, items: [string, string][], get: () => string, set: (v: string) => void) {
  const o = optionChoice({ label, hint, items, get, set: (v) => { set(v); changed(); } });
  refreshers.push(o.refresh);
  return o.element;
}

const fightersBtn = button({ label: `🧍 ${t("fighters")}`, id: "fighters-btn" });
const helpBtn = button({ label: "?", id: "help-btn", round: true });
const settingsUi = settingsMenu({
  title: t("settings"),
  rows: [
    // The two everyday cameras also stay on screen (the camera chip); the others live here.
    { id: "look", label: t("look"), control: seg(looks, () => settings.look, (v) => (settings.look = v), "look") },
    { id: "place", label: t("environment"), control: seg(places, () => settings.place, (v) => (settings.place = v), "place") },
    { id: "camera", label: t("camera"), control: seg(cameras, () => settings.camera, (v) => (settings.camera = v), "camera") },
    { id: "speed", label: t("speed"), control: seg<number>([[0.25, "¼×"], [0.5, "½×"], [1, "1×"]], () => settings.speed, (v) => (settings.speed = v), "speed") },
  ],
  options: [
    toggle("loop", t("optLoop"), t("optLoopHint")),
    toggle("mirror", t("optMirror"), t("optMirrorHint")),
    choice(t("optShow"), t("optShowHint"), [["both", t("both")], ["0", t("amber")], ["1", t("blue")]], () => settings.show, (v) => (settings.show = v)),
    choice(t("optEyes"), t("optEyesHint"), [["0", t("amber")], ["1", t("blue")]], () => settings.eyesOf, (v) => (settings.eyesOf = v)),
    toggle("oss", t("optOss"), t("optOssHint")),
    toggle("impact", t("optImpact"), t("optImpactHint")),
    toggle("degrees", t("optDegrees"), t("optDegreesHint")),
  ],
  actions: [fightersBtn, helpBtn],
});
const settingsPanel = settingsUi.panel;

const panelUi = panelView({
  icon: "favicon.svg",
  name: "bjj3d",
  searchPlaceholder: t("search"),
  about: t("about"),
  languages: LANGS.map((l) => ({ value: l, label: langName(l) })),
  language: settings.lang,
  languageTitle: t("language"),
  onSearch: () => renderPanel(),
  // Every text on the page changes; reloading is simpler than redrawing each one.
  onLanguage: (l) => { settings.lang = l; save(); page.reload(); },
  onTheme: () => { settings.theme = settings.theme === "dark" ? "light" : "dark"; changed(); },
  onClose: () => document.body.classList.remove("open"),
});
const card = titleCard();
const strip = filmstrip({
  onPlay: () => {
    if (ossUi.running) { cancelOss(); viewer.playing = true; return; }
    if (viewer.time >= viewer.last) viewer.time = 0;
    viewer.playing = !viewer.playing;
  },
  onPick: (i) => { cancelOss(); viewer.playing = false; viewer.time = stops[i]; },
  onScrub: (time) => { viewer.time = time; },
});
const ossUi = oss();
const ring = attention();
const drawer = customizerDrawer({ title: t("customize"), done: t("done"), onDone: () => setDrawer(false) });
const help = helpDialog({
  title: t("helpTitle"),
  steps: (["help1", "help2", "help3", "help4"] as const).map((k) => t(k)),
  video: { label: `▶ ${t("demoVideo")}`, href: "https://youtu.be/yeQPuzHseZg" },
  ok: t("helpOk"),
  onOk: () => { help.hidden = true; settings.helpSeen = true; save(); if (viewer.last > 0 && settings.oss) startOss(); },
  hidden: settings.helpSeen,
});
helpBtn.onclick = () => { help.hidden = false; };
const screen = cinema({
  panel: panelUi.element,
  menuLabel: `☰ ${t("menu")}`,
  onMenu: () => document.body.classList.toggle("open"),
  titleCard: card.element,
  camChip: seg(cameras.slice(0, 2), () => settings.camera, (v) => (settings.camera = v), "camchip", "glass"),
  settingsButton: settingsUi.button,
  settings: settingsPanel,
  oss: ossUi.element,
  attention: ring.element,
  customizer: drawer.element,
  help,
  player: strip.element,
});
document.body.replaceChildren(...screen.nodes, ...Array.from(document.body.querySelectorAll("script")));

const viewer = new Viewer(screen.canvas);
// ?graph=<file> loads another build of the data (for comparing builds side by side).
const db = await Db.load(query.get("graph") ?? "graph.json");
const file = db.file;

// Grabbing the view while the camera is directed hands it over.
viewer.onGrab = () => { settings.camera = "free"; changed(); };

let shownPlace = "", shownLook = "";
function applySettings() {
  refreshers.forEach((r) => r());
  document.documentElement.dataset.theme = settings.theme;
  panelUi.setTheme(settings.theme === "dark" ? "☾" : "☀", `${t("theme")}: ${settings.theme === "dark" ? t("themeDark") : t("themeLight")}`);
  if (shownPlace !== settings.place + settings.theme) { viewer.setEnvironment(settings.place, settings.theme); shownPlace = settings.place + settings.theme; }
  if (viewer.look !== settings.look) viewer.setLook(settings.look);
  viewer.speed = settings.speed;
  viewer.loop = settings.loop;
  viewer.impactEffect = settings.impact;
  viewer.visible = [settings.show !== "1", settings.show !== "0"];
  viewer.setMirrored(settings.mirror);
  const mode: CameraMode = settings.camera === "eyes" ? (settings.eyesOf === "0" ? "eyes0" : "eyes1") : settings.camera;
  if (viewer.cameraMode !== mode) viewer.setCamera(mode);
  // The filmstrip shows the fighters as they look now.
  if (shownLook && shownLook !== settings.look + settings.place + settings.theme + settings.mirror) renderStrip();
  shownLook = settings.look + settings.place + settings.theme + settings.mirror;
}
function changed() { save(); applySettings(); }

// --- customizing the fighters: thickness and belt, on a screen of their own

const BUILD: [number, number] = [0.85, 1.2];
const defaultStyle = (): Style => ({ build: 1, belt: "white" });
const styles: Style[] = [0, 1].map((i) => {
  const saved = settings.fighters[i] ?? {};
  const build = typeof saved.build === "number" ? Math.min(BUILD[1], Math.max(BUILD[0], saved.build)) : 1;
  const belt = BELTS.includes(saved.belt as BuiltinBelt) ? (saved.belt as BuiltinBelt) : "white";
  return { build, belt };
});
function applyStyle(i: number) {
  viewer.setStyle(i, styles[i]);
  settings.fighters[i] = styles[i];
  save();
}
styles.forEach((_, i) => applyStyle(i));

// The customizing screen shows the fighter standing, in GrappleMap's "staredown".
const standing = file.positions.findIndex((p) => p.name === "staredown");
if (standing >= 0) viewer.studioPose = db.poses({ type: "p", i: standing })[0];

const customizer = drawer.element;
fightersBtn.hidden = standing < 0;
// Customizing is its own screen: the rest of the interface steps aside, the fighter stands
// alone, and the camera follows what is being changed.
let wasPlaying = false;
const setDrawer = (open: boolean) => {
  document.body.classList.toggle("studio", open);
  customizer.hidden = !open;
  if (open) { wasPlaying = viewer.playing; viewer.playing = false; renderCustomizer(); }
  viewer.setViewShift(open ? -customizer.offsetWidth / 2 : 0);
  viewer.setStudio(open ? czFighter : null);
  if (!open) viewer.playing = wasPlaying;
};
fightersBtn.onclick = () => setDrawer(customizer.hidden);
let czFighter = 0;

function renderCustomizer() {
  const a = styles[czFighter];
  drawer.tabs.replaceWith(drawer.tabs = tabs({
    id: "cz-tabs",
    items: [0, 1].map((i) => ({ value: i, label: i === 0 ? t("amber") : t("blue"), color: COLORS[i] })),
    value: czFighter,
    onPick: (i) => { czFighter = i; viewer.setStudio(i); renderCustomizer(); },
  }));
  const BELT_LABEL = { white: "beltWhite", blue: "beltBlue", purple: "beltPurple", brown: "beltBrown", black: "beltBlack" } as const;
  const reset = button({
    label: t("reset"),
    onClick: () => { styles[czFighter] = defaultStyle(); applyStyle(czFighter); renderCustomizer(); viewer.focusStudio("body"); },
  });
  drawer.body.replaceChildren(
    el("h3", {}, t("body")),
    slider({
      label: t("thickness"), min: BUILD[0], max: BUILD[1], step: 0.01, value: a.build, ends: [t("buildThin"), t("buildStrong")],
      onFocus: () => viewer.focusStudio("body" as StudioFocus),
      onInput: (v) => { viewer.focusStudio("body"); a.build = v; applyStyle(czFighter); },
    }),
    el("h3", {}, t("belt")),
    swatchChoices({
      items: BELTS.map((b) => ({ value: b, label: t(BELT_LABEL[b]), color: BELT_COLORS[b] })),
      value: a.belt as BuiltinBelt,
      onPick: (b) => { viewer.focusStudio("belt"); a.belt = b; applyStyle(czFighter); renderCustomizer(); },
    }),
    el("div", { className: "cz-actions" }, reset),
    el("p", { className: "muted" }, t("fitNote")),
  );
}

// --- the local editor (dev only; the module and its server live outside any build)

if (import.meta.env.DEV) {
  const editorBtn = button({ label: "✎ Editor" });
  settingsUi.actions.append(editorBtn);
  let open = false;
  const openEditor = async () => {
    if (open) return;
    open = true;
    settingsPanel.hidden = true;
    const { openEditor } = await import("@bjj3d/editor");
    openEditor({ viewer, db, lang: currentLang, onClose: () => { open = false; route(); applySettings(); } });
  };
  editorBtn.onclick = openEditor;
  if (sessionStorage.getItem("bjj3d.editor")) openEditor();
}

// --- playback: play button, a filmstrip of the steps, and the next move

let stops: number[] = [];

// Oss!: the greeting, held for a second before a new fight starts (not when chaining).
const cancelOss = () => ossUi.cancel();
function startOss() {
  viewer.playing = false;
  ossUi.start(1050, () => { viewer.playing = true; });
}

const prevStop = () => { viewer.playing = false; viewer.time = [...stops].reverse().find((f) => f < viewer.time - 1e-3) ?? 0; };
const nextStop = () => { viewer.playing = false; viewer.time = stops.find((f) => f > viewer.time + 1e-3) ?? viewer.last; };
addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "search") return;
  if (e.key === " ") { e.preventDefault(); strip.play.click(); }
  if (e.key === "ArrowLeft") prevStop();
  if (e.key === "ArrowRight") nextStop();
});

/** Draws the filmstrip: one real frame per step (or per keyframe), plus the next move. */
let stripImages: string[] = [];
function renderStrip() {
  stripImages = viewer.thumbnails(stops);
  strip.setSteps(stops, stripImages, viewer.last);
  const end = current.type === "p" ? current.i : db.ends(current).to;
  const moves = end === null ? [] : db.outgoing[end];
  strip.setNext(moves.length ? {
    href: `#${refKey(moves[0])}`,
    label: t("nextShort"),
    title: title(moves[0]),
    more: moves.length > 1 ? t("moreMoves", { n: String(moves.length - 1) }) : undefined,
    onMore: () => document.body.classList.add("open"),
    onClick: () => { chainNext = true; },
  } : null);
}

// --- what is on screen

let current: Ref = { type: "p", i: 0 };
let chainNext = false;
const kindOf = (r: Ref) => (r.type === "t" ? file.transitions[r.i].kind : null);
const positionName = (i: number | null) => (i === null ? t("unlinked") : file.positions[i].name);

function title(r: Ref) {
  const tech = db.technique(r);
  if (tech) return pick(tech.names);
  // GrappleMap names finishes "tap" or "finish"; say what is being finished.
  const name = db.name(r);
  const from = db.ends(r).from;
  return /^(tap|finish|\.\.\.)$/i.test(name) && from !== null ? `${file.positions[from].name}: ${name}` : name;
}

/** One line saying what a ref is: "Move · from A to B" or "Position". */
function what(r: Ref) {
  if (r.type === "p") return t("position");
  const e = db.ends(r);
  const line = `${t("transition")} · ${t("fromTo", { a: positionName(e.from), b: positionName(e.to) })}`;
  return r.reversed ? `${line} (${t("reversed")})` : line;
}

function show(r: Ref) {
  const chain = chainNext;
  chainNext = false;
  current = r;
  const kind = kindOf(r);
  viewer.show({ poses: db.poses(r), substeps: r.type === "t" ? file.substeps : 1, kind, chain });
  cancelOss();

  const tech = db.technique(r);
  const keyframes = Array.from({ length: viewer.last + 1 }, (_, i) => i);
  stops = tech ? tech.steps.map((s) => s.frame) : keyframes;
  renderStrip();
  card.set({ kind: kind ? kindName(kind) : "", title: title(r), ends: r.type === "p" ? t("stillAt") : what(r) });
  document.title = `${title(r)} · bjj3d`;
  renderPanel();
  document.body.classList.remove("open");
  // A new fight (not a chained move, not a still position) opens with Oss!; it starts
  // after the strip is drawn, so slow thumbnails cannot eat its second.
  if (!chain && viewer.last > 0 && settings.oss && help.hidden) startOss();
}

viewer.onFrame = (f) => {
  // Progress: the current thumbnail is marked and fills up to the next stop.
  strip.setTime(f.time, viewer.playing, { play: t("play"), pause: t("pause") });
  const i = Math.max(0, stops.findLastIndex((s) => s <= f.time + 1e-3));
  const nowPic = document.querySelector<HTMLImageElement>("#now-pic");
  if (nowPic && stripImages[i] && nowPic.src !== stripImages[i]) nowPic.src = stripImages[i];

  // The subtitle: the current step if the technique has steps, else its name.
  const tech = db.technique(current);
  const step = tech ? [...tech.steps].reverse().find((s) => s.frame <= f.time + 1e-3) : undefined;
  const caption = step && tech ? `${tech.steps.indexOf(step) + 1}. ${pick(step.text)}` : title(current);
  if (strip.setCaption(caption)) {
    document.querySelectorAll("ol.steps li").forEach((li, k) => li.classList.toggle("now-step", tech?.steps[k] === step));
  }

  const kind = kindOf(current);
  if (kind && f.reading) strip.setRisk(tech?.risk ? pick(tech.risk) : risk(kind), f.reading.danger);
  else strip.setRisk(null, false);

  // The attention ring sits on the attacked joint while the lock is on; the finishing
  // moment darkens the edges, burns the ring and sends a pulse from the joint.
  const shown = !!(kind && f.reading && f.reading.value > 0.05 && f.joint);
  ring.set(shown ? f.joint : null, f.impact > 0.2, shown && settings.degrees ? measureLabel(kind!, f.reading!.measure) : null);
  screen.stage.style.setProperty("--impact", f.impact.toFixed(3));
  if (f.impactStart && f.joint) ring.pulse(screen.stage, f.joint);
};

// --- panel

/** A small image of where a ref ends (a position, or a transition's last frame), cached. */
const snaps = new Map<string, string>();
function snapFor(r: Ref): string {
  const key = refKey(r);
  let img = snaps.get(key);
  if (!img) {
    const poses = db.poses(r);
    img = viewer.snapshot(poses[poses.length - 1], kindOf(r));
    snaps.set(key, img);
  }
  return img;
}
const lazySnaps = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const img = e.target as HTMLImageElement;
    const r = parseRef(img.dataset.snap!);
    if (r) img.src = snapFor(r);
    lazySnaps.unobserve(img);
  }
}, { root: panelUi.body, rootMargin: "200px" });
function snapImage(r: Ref) {
  const img = el("img", { alt: "", draggable: false, "data-snap": refKey(r) }) as HTMLImageElement;
  lazySnaps.observe(img);
  return img;
}

/** A clickable row: a picture of where it ends, the name, what it is, and a badge for finishes. */
function row(r: Ref, opts: { chain?: boolean; sub?: string }) {
  const kind = kindOf(r);
  return refRow({
    href: `#${refKey(r)}`, title: title(r), picture: snapImage(r), kind: kind ? kindName(kind) : null, sub: opts.sub,
    chain: opts.chain, here: refKey(r) === refKey(current), onClick: opts.chain ? () => { chainNext = true; } : undefined,
  });
}

function nowCard() {
  const kind = kindOf(current);
  const mover = db.mover(current);
  const who = mover === null ? null : viewer.swapped ? 1 - mover : mover;
  const tech = db.technique(current);
  return nowCardView({
    kind: kind ? kindName(kind) : null,
    title: title(current),
    what: current.type === "p" ? t("stillAt") : what(current),
    mover: who === null ? undefined : { color: COLORS[who], text: t("mover", { who: who === 0 ? t("amber") : t("blue") }) },
    steps: tech?.steps.map((s) => ({ text: pick(s.text), onClick: () => { viewer.time = s.frame; viewer.playing = false; } })),
    notes: tech ? [...(tech.note ? [pick(tech.note)] : []), ...(tech.reviewed ? [] : [t("draft")])] : [],
  });
}

function nextMoves(): HTMLElement[] {
  const end = current.type === "p" ? current.i : db.ends(current).to;
  const moves = end === null ? [] : db.outgoing[end];
  if (!moves.length) return [eyebrow(t("next")), el("p", { className: "empty" }, t("noNext"))];
  return [
    eyebrow(t("next")),
    refList(moves.map((r) => row(r, { chain: true, sub: t("fromTo", { a: positionName(db.ends(r).from), b: positionName(db.ends(r).to) }) })), "rows moves"),
    el("p", { className: "muted" }, t("nextHint")),
  ];
}

const transitionRef = (i: number): Ref => ({ type: "t", i, reversed: false });
const TECHNIQUES = Object.keys(file.techniques).map((i) => transitionRef(+i));
/** Finishing moves: a submission kind and a name like "tap" or "finish". */
const SUBMISSIONS = file.transitions.flatMap((tr, i) => (tr.kind && /tap|finish|submit/i.test(tr.name) ? [transitionRef(i)] : []));
const POSITIONS = file.positions.map((_, i): Ref => ({ type: "p", i })).sort((a, b) => db.name(a).localeCompare(db.name(b)));
const TABS = {
  techniques: { label: t("tabTechniques"), hint: t("hintTechniques"), refs: TECHNIQUES },
  submissions: { label: t("tabSubmissions"), hint: t("hintSubmissions"), refs: SUBMISSIONS },
  positions: { label: t("tabPositions"), hint: t("hintPositions"), refs: POSITIONS },
};
let tab: keyof typeof TABS = "techniques";

function explore() {
  const { hint, refs } = TABS[tab];
  return [
    eyebrow(t("explore")),
    tabs({ items: (Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => ({ value: k, label: TABS[k].label })), value: tab, onPick: (k) => { tab = k; renderPanel(); } }),
    el("p", { className: "muted tab-hint" }, hint),
    refList(refs.map((r) => row(r, { sub: r.type === "t" ? what(r) : undefined }))),
  ];
}

function details() {
  const entry = current.type === "p" ? file.positions[current.i] : file.transitions[current.i];
  const chips = el("div", { className: "chips" }, ...entry.tags.map((tag) => {
    const b = el("button", { type: "button" }, tag.replaceAll("_", " "));
    b.onclick = () => { search.value = tag.replaceAll("_", " "); renderPanel(); };
    return b;
  }));
  const refs = el("div", { className: "refs" }, ...entry.refs.map((r) => {
    const url = /https?:\/\/\S+/.exec(r)?.[0];
    const text = r.replace(/\s*@?\s*https?:\/\/\S+/, "").trim();
    return el("p", {}, url ? el("a", { href: url, target: "_blank", rel: "noopener" }, text || url) : text);
  }));
  const into = current.type === "p" ? db.incoming[current.i] : [];
  return el("details", { className: "more" }, el("summary", {}, t("details")),
    entry.description.length ? el("p", { className: "muted" }, entry.description.join(" ")) : null,
    entry.tags.length ? chips : null,
    entry.refs.length ? refs : null,
    into.length ? eyebrow(t("into")) : null,
    into.length ? refList(into.map((r) => row(r, { sub: what(r) }))) : null,
    el("p", { className: "muted" }, t("source", { n: String(entry.line) })));
}

const search = panelUi.search;

function renderPanel() {
  const body = panelUi.body;
  const q = search.value.trim();
  if (q) {
    const hits = db.search(q);
    body.replaceChildren(eyebrow(t("results")), hits.length
      ? refList(hits.map((r) => row(r, { sub: what(r) })))
      : el("p", { className: "empty" }, t("noResults")));
  } else body.replaceChildren(eyebrow(t("now")), nowCard(), ...nextMoves(), ...explore(), details());
}

// --- routing

function route() {
  const r = parseRef(location.hash.slice(1));
  const valid = r && (r.type === "p" ? r.i < file.positions.length : r.i < file.transitions.length);
  show(valid ? r! : TECHNIQUES[0] ?? { type: "p", i: 0 });
}
addEventListener("hashchange", route);
applySettings();
route();

// For checking: ?frame=<n> opens paused at a keyframe, ?debug=1 draws the stick figures.
viewer.showSticks(query.get("debug") === "1");
if (query.get("debug") === "1") Object.assign(window, { viewer });
const frame = query.get("frame");
if (frame !== null) { cancelOss(); viewer.time = Math.min(Number(frame), viewer.last); viewer.playing = false; }
