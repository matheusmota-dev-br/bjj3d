import "./style.css";
import { Db, parseRef, refKey, type Ref } from "./data.ts";
import type { Place, Theme } from "./environment.ts";
import { kindName, langName, LANGS, measureLabel, pick, risk, setLang, t } from "./i18n.ts";
import type { Look } from "./materials.ts";
import { BELT_COLORS, BELTS, type Belt } from "./mannequin.ts";
import { COLORS, Viewer, type CameraMode, type StudioFocus, type Style } from "./viewer.ts";

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string | null)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "style" || k.startsWith("aria-") || k.startsWith("data-")) e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  e.append(...kids.filter((x): x is Node | string => x !== null));
  return e;
}

// --- settings kept per viewer (they only make the page nicer; it works without them)

type Camera = "free" | "side" | "top" | "eyes";
const SETTINGS_KEY = "bjj-3d.settings.v2";
const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
const settings = {
  lang: "pt-BR", theme: (prefersDark ? "dark" : "light") as Theme, place: "mat" as Place,
  look: "solid" as Look, camera: "free" as Camera, eyesOf: "1", speed: 1, show: "both",
  loop: false, mirror: false, degrees: false, bands: false, helpSeen: false,
  fighters: [] as Partial<Style>[],
};
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}")); } catch { /* private mode */ }
const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

// --- boot

setLang(settings.lang);
document.documentElement.dataset.theme = settings.theme;
const query = new URLSearchParams(location.search);
const viewer = new Viewer($<HTMLCanvasElement>("#view"));
// ?graph=<file> loads another build of the data (for comparing builds side by side).
const db = await Db.load(query.get("graph") ?? "graph.json");
const file = db.file;

// --- floating settings bar

/** A row of buttons where one is chosen. */
function segmented<V extends string | number>(root: HTMLElement, items: [V, string][], get: () => V, set: (v: V) => void) {
  const buttons = items.map(([value, label]) => {
    const b = el("button", { type: "button", "aria-pressed": "false", "data-value": String(value) }, label);
    b.onclick = () => { set(value); changed(); };
    return [value, b] as const;
  });
  root.replaceChildren(...buttons.map(([, b]) => b));
  return () => buttons.forEach(([v, b]) => b.setAttribute("aria-pressed", String(v === get())));
}

/** Popovers close when clicking anywhere else. */
const popovers: { panel: HTMLElement; button: HTMLElement }[] = [];
function openPopover(panel: HTMLElement, button: HTMLElement, open: boolean) {
  for (const p of popovers) if (p.panel !== panel) { p.panel.hidden = true; p.button.setAttribute("aria-expanded", "false"); }
  panel.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}
addEventListener("click", (e) => {
  for (const p of popovers) if (!p.panel.hidden && !p.panel.contains(e.target as Node) && !p.button.contains(e.target as Node)) openPopover(p.panel, p.button, false);
});

/** A button showing the current choice ("Look: Human ▾") that opens a short list. */
function dropdown<V extends string>(root: HTMLElement, label: string, items: [V, string][], get: () => V, set: (v: V) => void) {
  const button = el("button", { type: "button", className: "chip-btn", "aria-expanded": "false" });
  const panel = el("div", { className: "popover menu-list" });
  panel.hidden = true;
  const entries = items.map(([value, text]) => {
    const b = el("button", { type: "button", "data-value": value, role: "menuitemradio" }, text);
    b.onclick = () => { set(value); changed(); openPopover(panel, button, false); };
    panel.append(b);
    return [value, b] as const;
  });
  button.onclick = () => openPopover(panel, button, panel.hidden);
  popovers.push({ panel, button });
  root.replaceChildren(button, panel);
  return () => {
    const chosen = items.find(([v]) => v === get());
    button.replaceChildren(el("span", { className: "label" }, `${label} `), chosen?.[1] ?? "", " ▾");
    entries.forEach(([v, b]) => b.setAttribute("aria-checked", String(v === get())));
  };
}

const refreshers: (() => void)[] = [];
$("#camera-label").textContent = t("camera");
const looks: [Look, string][] = [["solid", t("lookSolid")], ["wood", t("lookWood")], ["hologram", t("lookHologram")]];
// Older saved settings may name a look that no longer exists.
if (!looks.some(([l]) => l === settings.look)) settings.look = "solid";
refreshers.push(dropdown($("#look"), t("look"), looks, () => settings.look, (v) => (settings.look = v)));
const places: [Place, string][] = [["mat", t("envMat")], ["gym", t("envGym")], ["studio", t("envStudio")], ["night", t("envNight")]];
refreshers.push(dropdown($("#place"), t("environment"), places, () => settings.place, (v) => (settings.place = v)));
refreshers.push(segmented($("#camera"), [["free", t("camFree")], ["side", t("camSide")], ["top", t("camTop")], ["eyes", t("camEyes")]] as [Camera, string][], () => settings.camera, (v) => (settings.camera = v)));
refreshers.push(dropdown($("#speed"), t("speed"), [["0.25", "¼×"], ["0.5", "½×"], ["1", "1×"]], () => String(settings.speed) as "0.25" | "0.5" | "1", (v) => (settings.speed = Number(v))));

// Options: each with a line saying what it does.
const optionsBtn = $<HTMLButtonElement>("#options-btn");
const options = $("#options");
optionsBtn.textContent = `${t("options")} ▾`;
optionsBtn.onclick = () => openPopover(options, optionsBtn, options.hidden);
popovers.push({ panel: options, button: optionsBtn });
function toggle(key: "loop" | "mirror" | "degrees", label: string, hint: string) {
  const box = el("input", { type: "checkbox" }) as HTMLInputElement;
  box.onchange = () => { settings[key] = box.checked; changed(); };
  refreshers.push(() => { box.checked = settings[key]; });
  return el("label", { className: "option" }, box, el("div", {}, el("b", {}, label), el("span", {}, hint)));
}
function choice(label: string, hint: string, items: [string, string][], get: () => string, set: (v: string) => void) {
  const seg = el("div", { className: "seg" });
  refreshers.push(segmented(seg, items, get, set));
  return el("div", { className: "option" }, el("div", {}, el("b", {}, label), el("span", {}, hint), seg));
}
options.append(
  toggle("loop", t("optLoop"), t("optLoopHint")),
  toggle("mirror", t("optMirror"), t("optMirrorHint")),
  choice(t("optShow"), t("optShowHint"), [["both", t("both")], ["0", t("amber")], ["1", t("blue")]], () => settings.show, (v) => (settings.show = v)),
  choice(t("optEyes"), t("optEyesHint"), [["0", t("amber")], ["1", t("blue")]], () => settings.eyesOf, (v) => (settings.eyesOf = v)),
  toggle("degrees", t("optDegrees"), t("optDegreesHint")),
);

// On a phone the bar folds into one button.
$("#toolbar-toggle").textContent = `⚙ ${t("settings")}`;
$("#toolbar-toggle").onclick = () => $("#toolbar").classList.toggle("open");
$("#menu").textContent = `☰ ${t("menu")}`;
$("#menu").onclick = () => document.body.classList.toggle("open");

// Language and theme, at the top of the panel.
const langSel = $<HTMLSelectElement>("#lang");
langSel.title = t("language");
for (const l of LANGS) langSel.append(el("option", { value: l, textContent: langName(l) }));
langSel.value = settings.lang;
// Every text on the page changes; reloading is simpler than redrawing each one.
langSel.onchange = () => { settings.lang = langSel.value; save(); location.reload(); };
const themeBtn = $<HTMLButtonElement>("#theme");
themeBtn.onclick = () => { settings.theme = settings.theme === "dark" ? "light" : "dark"; changed(); };

let shownPlace = "";
function applySettings() {
  refreshers.forEach((r) => r());
  document.documentElement.dataset.theme = settings.theme;
  themeBtn.textContent = settings.theme === "dark" ? "☾" : "☀";
  themeBtn.title = `${t("theme")}: ${settings.theme === "dark" ? t("themeDark") : t("themeLight")}`;
  if (shownPlace !== settings.place + settings.theme) { viewer.setEnvironment(settings.place, settings.theme); shownPlace = settings.place + settings.theme; }
  if (viewer.look !== settings.look) viewer.setLook(settings.look);
  viewer.speed = settings.speed;
  viewer.loop = settings.loop;
  viewer.visible = [settings.show !== "1", settings.show !== "0"];
  viewer.setMirrored(settings.mirror);
  const mode: CameraMode = settings.camera === "eyes" ? (settings.eyesOf === "0" ? "eyes0" : "eyes1") : settings.camera;
  if (viewer.cameraMode !== mode) viewer.setCamera(mode);
}
function changed() { save(); applySettings(); }

// --- customizing the fighters: thickness and belt, on a screen of their own

const BUILD: [number, number] = [0.85, 1.2];
const defaultStyle = (): Style => ({ build: 1, belt: "white" });
const styles: Style[] = [0, 1].map((i) => {
  const saved = settings.fighters[i] ?? {};
  const build = typeof saved.build === "number" ? Math.min(BUILD[1], Math.max(BUILD[0], saved.build)) : 1;
  const belt = BELTS.includes(saved.belt as Belt) ? (saved.belt as Belt) : "white";
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

const customizer = $("#customizer");
const fightersBtn = $<HTMLButtonElement>("#fighters-btn");
fightersBtn.textContent = `🧍 ${t("fighters")}`;
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
$("#cz-title").textContent = t("customize");
$("#cz-done").textContent = t("done");
$("#cz-done").onclick = () => setDrawer(false);
let czFighter = 0;

function renderCustomizer() {
  const a = styles[czFighter];
  $("#cz-tabs").replaceChildren(...[0, 1].map((i) => {
    const b = el("button", { type: "button", role: "tab", "aria-selected": String(i === czFighter) },
      el("span", { className: "dot", style: `background:${COLORS[i]};margin-inline-end:6px` }), i === 0 ? t("amber") : t("blue"));
    b.onclick = () => { czFighter = i; viewer.setStudio(i); renderCustomizer(); };
    return b;
  }));
  const focus = (part: StudioFocus) => () => viewer.focusStudio(part);
  const build = el("input", { type: "range", min: String(BUILD[0]), max: String(BUILD[1]), step: "0.01", value: String(a.build) }) as HTMLInputElement;
  build.onpointerdown = build.onfocus = focus("body");
  build.oninput = () => { viewer.focusStudio("body"); a.build = Number(build.value); applyStyle(czFighter); };
  const BELT_LABEL = { white: "beltWhite", blue: "beltBlue", purple: "beltPurple", brown: "beltBrown", black: "beltBlack" } as const;
  const belts = el("div", { className: "choices" }, ...BELTS.map((b) => {
    const btn = el("button", { type: "button", "aria-pressed": String(a.belt === b) }, el("span", { className: "swatch", style: `background:${BELT_COLORS[b]}` }), t(BELT_LABEL[b]));
    btn.onclick = () => { viewer.focusStudio("belt"); a.belt = b; applyStyle(czFighter); renderCustomizer(); };
    return btn;
  }));
  const reset = el("button", { type: "button", className: "chip-btn" }, t("reset"));
  reset.onclick = () => { styles[czFighter] = defaultStyle(); applyStyle(czFighter); renderCustomizer(); viewer.focusStudio("body"); };
  $("#cz-body").replaceChildren(
    el("h3", {}, t("body")),
    el("div", { className: "slider" }, el("label", {}, t("thickness")), el("output", {}), build,
      el("div", { className: "ends" }, el("span", {}, t("buildThin")), el("span", {}, t("buildStrong")))),
    el("h3", {}, t("belt")),
    belts,
    el("div", { className: "cz-actions" }, reset),
    el("p", { className: "muted" }, t("fitNote")),
  );
}

// --- how to use, shown once

$("#help-title").textContent = t("helpTitle");
$("#help-steps").replaceChildren(...(["help1", "help2", "help3", "help4"] as const).map((k) => el("li", {}, t(k))));
$("#help-ok").textContent = t("helpOk");
$("#help-ok").onclick = () => { $("#help").hidden = true; settings.helpSeen = true; save(); };
$("#help-btn").onclick = () => { $("#help").hidden = false; };
$("#help").hidden = settings.helpSeen;

// --- playback

const slider = $<HTMLInputElement>("#time");
const playBtn = $<HTMLButtonElement>("#play");
let stops: number[] = [];
playBtn.onclick = () => {
  if (viewer.time >= viewer.last) viewer.time = 0;
  viewer.playing = !viewer.playing;
};
slider.oninput = () => { viewer.time = Number(slider.value); viewer.playing = false; };
$("#prev").title = t("prev");
$("#next").title = t("nextStep");
$("#prev").onclick = () => { viewer.playing = false; viewer.time = [...stops].reverse().find((f) => f < viewer.time - 1e-3) ?? 0; };
$("#next").onclick = () => { viewer.playing = false; viewer.time = stops.find((f) => f > viewer.time + 1e-3) ?? viewer.last; };
addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "search") return;
  if (e.key === " ") { e.preventDefault(); playBtn.click(); }
  if (e.key === "ArrowLeft") $("#prev").click();
  if (e.key === "ArrowRight") $("#next").click();
});

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

  const tech = db.technique(r);
  const keyframes = Array.from({ length: viewer.last + 1 }, (_, i) => i);
  stops = tech ? tech.steps.map((s) => s.frame) : keyframes;
  $("#ticks").replaceChildren(...keyframes.map((i) =>
    el("span", { className: tech && stops.includes(i) ? "step" : "", style: `left:${viewer.last ? (i / viewer.last) * 100 : 0}%` })));
  slider.max = String(viewer.last);
  slider.disabled = viewer.last === 0;
  document.title = `${title(r)} · bjj-3d`;
  renderPanel();
  document.body.classList.remove("open");
}

viewer.onFrame = (f) => {
  slider.value = String(f.time);
  playBtn.textContent = viewer.playing ? "❚❚" : "▶";
  playBtn.title = viewer.playing ? t("pause") : t("play");

  // The subtitle: the current step if the technique has steps, else its name.
  const tech = db.technique(current);
  const step = tech ? [...tech.steps].reverse().find((s) => s.frame <= f.time + 1e-3) : undefined;
  const caption = step && tech ? `${tech.steps.indexOf(step) + 1}. ${pick(step.text)}` : title(current);
  if ($("#caption").textContent !== caption) {
    $("#caption").textContent = caption;
    document.querySelectorAll("ol.steps li").forEach((li, i) => li.classList.toggle("now-step", tech?.steps[i] === step));
  }

  const kind = kindOf(current);
  const riskEl = $("#risk");
  if (kind && f.reading) {
    riskEl.textContent = tech?.risk ? pick(tech.risk) : risk(kind);
    riskEl.classList.toggle("on", f.reading.danger);
  } else riskEl.classList.remove("on");

  const angle = $("#angle");
  const shown = !!(settings.degrees && kind && f.reading && f.reading.value > 0.05 && f.joint);
  angle.classList.toggle("on", shown);
  if (shown) {
    angle.style.left = `${f.joint!.x}px`;
    angle.style.top = `${f.joint!.y}px`;
    angle.textContent = measureLabel(kind!, f.reading!.measure);
  }
};

// --- panel

/** A clickable row: the name, what it is, and a badge for finishes. */
function row(r: Ref, opts: { chain?: boolean; sub?: string } = {}) {
  const kind = kindOf(r);
  const a = el("a", { href: `#${refKey(r)}` },
    el("span", { className: "main" }, kind ? el("span", { className: "kind" }, kindName(kind)) : null, title(r), opts.chain ? el("span", { className: "go" }, "→") : null),
    opts.sub ? el("span", { className: "sub" }, opts.sub) : null);
  if (refKey(r) === refKey(current)) a.classList.add("here");
  if (opts.chain) a.onclick = () => { chainNext = true; };
  return el("li", {}, a);
}

function nowCard() {
  const card = el("section", { className: "now" }, el("h2", {}, title(current)));
  const kind = kindOf(current);
  if (kind) card.prepend(el("span", { className: "kind" }, kindName(kind)));
  card.append(el("p", { className: "what" }, current.type === "p" ? t("stillAt") : what(current)));
  const mover = db.mover(current);
  if (mover !== null) {
    const body = viewer.swapped ? 1 - mover : mover;
    card.append(el("p", { className: "mover" }, el("span", { className: "dot", style: `background:${COLORS[body]}` }), t("mover", { who: body === 0 ? t("amber") : t("blue") })));
  }
  const tech = db.technique(current);
  if (tech) {
    card.append(el("ol", { className: "steps" }, ...tech.steps.map((s) => {
      const li = el("li", {}, pick(s.text));
      li.onclick = () => { viewer.time = s.frame; viewer.playing = false; };
      return li;
    })));
    if (tech.note) card.append(el("p", { className: "muted note" }, pick(tech.note)));
    if (!tech.reviewed) card.append(el("p", { className: "muted note" }, t("draft")));
  }
  return card;
}

function nextMoves(): HTMLElement[] {
  const end = current.type === "p" ? current.i : db.ends(current).to;
  const moves = end === null ? [] : db.outgoing[end];
  if (!moves.length) return [el("p", { className: "eyebrow" }, t("next")), el("p", { className: "empty" }, t("noNext"))];
  return [
    el("p", { className: "eyebrow" }, t("next")),
    el("ul", { className: "rows moves" }, ...moves.map((r) => row(r, { chain: true, sub: t("fromTo", { a: positionName(db.ends(r).from), b: positionName(db.ends(r).to) }) }))),
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
  const tabs = el("div", { className: "tabs", role: "tablist" }, ...(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => {
    const b = el("button", { type: "button", role: "tab", "aria-selected": String(k === tab) }, TABS[k].label);
    b.onclick = () => { tab = k; renderPanel(); };
    return b;
  }));
  const { hint, refs } = TABS[tab];
  return [
    el("p", { className: "eyebrow" }, t("explore")),
    tabs,
    el("p", { className: "muted tab-hint" }, hint),
    el("ul", { className: "rows" }, ...refs.map((r) => row(r, { sub: r.type === "t" ? what(r) : undefined }))),
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
    into.length ? el("p", { className: "eyebrow" }, t("into")) : null,
    into.length ? el("ul", { className: "rows" }, ...into.map((r) => row(r, { sub: what(r) }))) : null,
    el("p", { className: "muted" }, t("source", { n: String(entry.line) })));
}

const search = $<HTMLInputElement>("#search");
search.placeholder = t("search");
search.oninput = () => renderPanel();
$("#about").textContent = t("about");

function renderPanel() {
  const body = $("#panel-body");
  const q = search.value.trim();
  if (q) {
    const hits = db.search(q);
    body.replaceChildren(el("p", { className: "eyebrow" }, t("results")), hits.length
      ? el("ul", { className: "rows" }, ...hits.map((r) => row(r, { sub: what(r) })))
      : el("p", { className: "empty" }, t("noResults")));
  } else body.replaceChildren(el("p", { className: "eyebrow" }, t("now")), nowCard(), ...nextMoves(), ...explore(), details());
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
if (frame !== null) { viewer.time = Math.min(Number(frame), viewer.last); viewer.playing = false; }
