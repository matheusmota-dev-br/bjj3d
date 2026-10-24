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

type Camera = "directed" | "free" | "side" | "top" | "eyes";
const SETTINGS_KEY = "bjj-3d.settings.v2";
const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
const settings = {
  lang: "pt-BR", theme: (prefersDark ? "dark" : "light") as Theme, place: "mat" as Place,
  look: "solid" as Look, camera: "directed" as Camera, eyesOf: "1", speed: 1, show: "both",
  loop: false, mirror: false, degrees: false, impact: true, oss: true, helpSeen: false,
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

// --- the settings popover (⚙) and the camera chip

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

const refreshers: (() => void)[] = [];
const looks: [Look, string][] = [["solid", t("lookSolid")], ["wood", t("lookWood")], ["hologram", t("lookHologram")]];
// Older saved settings may name a look or camera that no longer exists.
if (!looks.some(([l]) => l === settings.look)) settings.look = "solid";
if (!["directed", "free", "side", "top", "eyes"].includes(settings.camera)) settings.camera = "directed";
$("#look-label").textContent = t("look");
$("#place-label").textContent = t("environment");
$("#camera-label").textContent = t("camera");
$("#speed-label").textContent = t("speed");
refreshers.push(segmented($("#look"), looks, () => settings.look, (v) => (settings.look = v)));
const places: [Place, string][] = [["mat", t("envMat")], ["gym", t("envGym")], ["studio", t("envStudio")], ["night", t("envNight")]];
refreshers.push(segmented($("#place"), places, () => settings.place, (v) => (settings.place = v)));
const cameras: [Camera, string][] = [["directed", t("camDirected")], ["free", t("camFree")], ["side", t("camSide")], ["top", t("camTop")], ["eyes", t("camEyes")]];
refreshers.push(segmented($("#camera"), cameras, () => settings.camera, (v) => (settings.camera = v)));
// The two everyday cameras stay on screen; the others live in the settings.
refreshers.push(segmented($("#camchip"), cameras.slice(0, 2), () => settings.camera, (v) => (settings.camera = v)));
refreshers.push(segmented($("#speed"), [[0.25, "¼×"], [0.5, "½×"], [1, "1×"]], () => settings.speed, (v) => (settings.speed = v)));

const settingsBtn = $<HTMLButtonElement>("#settings-btn");
const settingsPanel = $("#settings");
settingsBtn.textContent = "⚙";
settingsBtn.title = t("settings");
settingsBtn.onclick = () => { settingsPanel.hidden = !settingsPanel.hidden; settingsBtn.setAttribute("aria-expanded", String(!settingsPanel.hidden)); };
addEventListener("click", (e) => {
  if (!settingsPanel.hidden && !settingsPanel.contains(e.target as Node) && !settingsBtn.contains(e.target as Node)) { settingsPanel.hidden = true; settingsBtn.setAttribute("aria-expanded", "false"); }
});

// Options: each with a line saying what it does.
const options = $("#options");
function toggle(key: "loop" | "mirror" | "degrees" | "impact" | "oss", label: string, hint: string) {
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
  toggle("oss", t("optOss"), t("optOssHint")),
  toggle("impact", t("optImpact"), t("optImpactHint")),
  toggle("degrees", t("optDegrees"), t("optDegreesHint")),
);

// The panel slides over the view.
$("#menu").textContent = `☰ ${t("menu")}`;
$("#menu").onclick = () => document.body.classList.toggle("open");
$("#panel-close").onclick = () => document.body.classList.remove("open");
// Grabbing the view while the camera is directed hands it over.
viewer.onGrab = () => { settings.camera = "free"; changed(); };

// Language and theme, at the foot of the panel.
const langSel = $<HTMLSelectElement>("#lang");
langSel.title = t("language");
for (const l of LANGS) langSel.append(el("option", { value: l, textContent: langName(l) }));
langSel.value = settings.lang;
// Every text on the page changes; reloading is simpler than redrawing each one.
langSel.onchange = () => { settings.lang = langSel.value; save(); location.reload(); };
const themeBtn = $<HTMLButtonElement>("#theme");
themeBtn.onclick = () => { settings.theme = settings.theme === "dark" ? "light" : "dark"; changed(); };

let shownPlace = "", shownLook = "";
function applySettings() {
  refreshers.forEach((r) => r());
  document.documentElement.dataset.theme = settings.theme;
  themeBtn.textContent = settings.theme === "dark" ? "☾" : "☀";
  themeBtn.title = `${t("theme")}: ${settings.theme === "dark" ? t("themeDark") : t("themeLight")}`;
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

// --- the local editor (dev only; the module and its server live outside any build)

if (import.meta.env.DEV) {
  const editorBtn = el("button", { type: "button", className: "chip-btn" }, "✎ Editor");
  $("#settings .actions").append(editorBtn);
  let open = false;
  const openEditor = async () => {
    if (open) return;
    open = true;
    settingsPanel.hidden = true;
    const { openEditor } = await import("./editor.ts");
    openEditor({ viewer, db, onClose: () => { open = false; route(); applySettings(); } });
  };
  editorBtn.onclick = openEditor;
  if (sessionStorage.getItem("bjj-3d.editor")) openEditor();
}

// --- how to use, shown once

$("#help-title").textContent = t("helpTitle");
$("#help-steps").replaceChildren(...(["help1", "help2", "help3", "help4"] as const).map((k) => el("li", {}, t(k))));
$("#help-ok").textContent = t("helpOk");
$("#help-ok").onclick = () => { $("#help").hidden = true; settings.helpSeen = true; save(); if (viewer.last > 0 && settings.oss) startOss(); };
$("#help-btn").onclick = () => { $("#help").hidden = false; };
$("#help").hidden = settings.helpSeen;

// --- playback: play button, a filmstrip of the steps, and the next move

const playBtn = $<HTMLButtonElement>("#play");
const thumbs = $("#thumbs");
let stops: number[] = [];

// Oss!: the greeting, held for a second before a new fight starts (not when chaining).
const ossEl = $("#oss");
let ossTimer: ReturnType<typeof setTimeout> | null = null;
function cancelOss() {
  if (ossTimer) clearTimeout(ossTimer);
  ossTimer = null;
  ossEl.hidden = true;
}
function startOss() {
  cancelOss();
  viewer.playing = false;
  ossEl.hidden = false;
  // Restart the animations even if the element was just shown.
  for (const e of Array.from(ossEl.children) as HTMLElement[]) { e.style.animation = "none"; void e.offsetWidth; e.style.animation = ""; }
  ossTimer = setTimeout(() => { ossTimer = null; ossEl.hidden = true; viewer.playing = true; }, 1050);
}

playBtn.onclick = () => {
  if (ossTimer) { cancelOss(); viewer.playing = true; return; }
  if (viewer.time >= viewer.last) viewer.time = 0;
  viewer.playing = !viewer.playing;
};
const prevStop = () => { viewer.playing = false; viewer.time = [...stops].reverse().find((f) => f < viewer.time - 1e-3) ?? 0; };
const nextStop = () => { viewer.playing = false; viewer.time = stops.find((f) => f > viewer.time + 1e-3) ?? viewer.last; };
addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "search") return;
  if (e.key === " ") { e.preventDefault(); playBtn.click(); }
  if (e.key === "ArrowLeft") prevStop();
  if (e.key === "ArrowRight") nextStop();
});

/** Time under a point of the strip: each thumbnail spans from its stop to the next. */
function timeAt(x: number): number | null {
  const items = Array.from(thumbs.querySelectorAll<HTMLElement>(".thumb"));
  for (const [i, item] of items.entries()) {
    const r = item.getBoundingClientRect();
    if (x >= r.left && x <= r.right) {
      const from = stops[i], to = stops[i + 1] ?? viewer.last;
      return from + ((x - r.left) / r.width) * (to - from);
    }
  }
  return null;
}
let scrubbing = false;
thumbs.addEventListener("pointerdown", (e) => {
  const item = (e.target as HTMLElement).closest<HTMLElement>(".thumb");
  if (!item) return;
  scrubbing = true;
  thumbs.setPointerCapture(e.pointerId);
  cancelOss();
  viewer.playing = false;
  viewer.time = stops[+item.dataset.i!];
});
thumbs.addEventListener("pointermove", (e) => {
  if (!scrubbing) return;
  const time = timeAt(e.clientX);
  if (time !== null) viewer.time = time;
});
const endScrub = () => { scrubbing = false; };
thumbs.addEventListener("pointerup", endScrub);
thumbs.addEventListener("pointercancel", endScrub);

/** Draws the filmstrip: one real frame per step (or per keyframe), plus the next move. */
let stripImages: string[] = [];
function renderStrip() {
  const images = viewer.thumbnails(stops);
  stripImages = images;
  thumbs.replaceChildren(...stops.map((_, i) => el("div", { className: "thumb", "data-i": String(i) },
    el("img", { src: images[i], alt: "", draggable: false }),
    el("span", { className: "n" }, String(i + 1)),
    el("span", { className: "fill" }))));

  const chip = $<HTMLAnchorElement>("#next-chip");
  const end = current.type === "p" ? current.i : db.ends(current).to;
  const moves = end === null ? [] : db.outgoing[end];
  chip.hidden = moves.length === 0;
  if (moves.length) {
    const first = moves[0];
    chip.href = `#${refKey(first)}`;
    chip.onclick = () => { chainNext = true; };
    chip.replaceChildren(el("span", {}, `${t("nextShort")} →`), el("b", {}, title(first)));
    if (moves.length > 1) {
      const more = el("span", { className: "muted", style: "cursor:pointer" }, t("moreMoves", { n: String(moves.length - 1) }));
      more.onclick = (e) => { e.preventDefault(); e.stopPropagation(); document.body.classList.add("open"); };
      chip.append(more);
    }
  }
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
  $("#kind").textContent = kind ? kindName(kind) : "";
  $("#title").textContent = title(r);
  $("#ends").textContent = r.type === "p" ? t("stillAt") : what(r);
  document.title = `${title(r)} · bjj-3d`;
  renderPanel();
  document.body.classList.remove("open");
  // A new fight (not a chained move, not a still position) opens with Oss!; it starts
  // after the strip is drawn, so slow thumbnails cannot eat its second.
  if (!chain && viewer.last > 0 && settings.oss && $("#help").hidden) startOss();
}

viewer.onFrame = (f) => {
  // Progress: the current thumbnail is marked and fills up to the next stop.
  const i = Math.max(0, stops.findLastIndex((s) => s <= f.time + 1e-3));
  const nowPic = document.querySelector<HTMLImageElement>("#now-pic");
  if (nowPic && stripImages[i] && nowPic.src !== stripImages[i]) nowPic.src = stripImages[i];
  thumbs.querySelectorAll<HTMLElement>(".thumb").forEach((item, k) => {
    item.classList.toggle("now", k === i);
    const from = stops[k], to = stops[k + 1] ?? viewer.last;
    const fill = item.querySelector<HTMLElement>(".fill")!;
    fill.style.width = k === i && to > from ? `${Math.min(1, (f.time - from) / (to - from)) * 100}%` : k < i ? "100%" : "0";
  });
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

  // The attention ring sits on the attacked joint while the lock is on.
  const attention = $("#attention");
  const shown = !!(kind && f.reading && f.reading.value > 0.05 && f.joint);
  attention.classList.toggle("on", shown);
  if (shown) {
    attention.style.left = `${f.joint!.x}px`;
    attention.style.top = `${f.joint!.y}px`;
  }
  const angle = $("#angle");
  angle.classList.toggle("on", shown && settings.degrees);
  if (shown && settings.degrees) angle.textContent = measureLabel(kind!, f.reading!.measure);

  // The finishing moment: the edges darken, the ring burns, a pulse leaves the joint.
  const stage = $("#stage");
  stage.style.setProperty("--impact", f.impact.toFixed(3));
  attention.classList.toggle("hot", f.impact > 0.2);
  if (f.impactStart && f.joint) {
    const pulse = el("span", { className: "pulse", style: `left:${f.joint.x}px;top:${f.joint.y}px` });
    stage.append(pulse);
    pulse.addEventListener("animationend", () => pulse.remove());
  }
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
}, { root: $("#panel-body"), rootMargin: "200px" });
function snapImage(r: Ref) {
  const img = el("img", { alt: "", draggable: false, "data-snap": refKey(r) }) as HTMLImageElement;
  lazySnaps.observe(img);
  return img;
}

/** A clickable row: a picture of where it ends, the name, what it is, and a badge for finishes. */
function row(r: Ref, opts: { chain?: boolean; sub?: string } = {}) {
  const kind = kindOf(r);
  const a = el("a", { href: `#${refKey(r)}` },
    el("span", { className: "pic" }, snapImage(r)),
    el("span", { className: "text" },
      el("span", { className: "main" }, title(r), opts.chain ? el("span", { className: "go" }, "→") : null),
      kind ? el("span", { className: "kind" }, kindName(kind)) : null,
      opts.sub ? el("span", { className: "sub" }, opts.sub) : null));
  if (refKey(r) === refKey(current)) a.classList.add("here");
  if (opts.chain) a.onclick = () => { chainNext = true; };
  return el("li", {}, a);
}

function nowCard() {
  const kind = kindOf(current);
  const card = el("section", { className: "now" },
    el("div", { className: "pic" }, el("img", { id: "now-pic", alt: "", draggable: false }), kind ? el("span", { className: "kind" }, kindName(kind)) : null),
    el("div", { className: "body" }, el("h2", {}, title(current)), el("p", { className: "what" }, current.type === "p" ? t("stillAt") : what(current))));
  const body = card.lastElementChild as HTMLElement;
  const append = (...nodes: HTMLElement[]) => body.append(...nodes);
  const mover = db.mover(current);
  if (mover !== null) {
    const who = viewer.swapped ? 1 - mover : mover;
    append(el("p", { className: "mover" }, el("span", { className: "dot", style: `background:${COLORS[who]}` }), t("mover", { who: who === 0 ? t("amber") : t("blue") })));
  }
  const tech = db.technique(current);
  if (tech) {
    append(el("ol", { className: "steps" }, ...tech.steps.map((s) => {
      const li = el("li", {}, pick(s.text));
      li.onclick = () => { viewer.time = s.frame; viewer.playing = false; };
      return li;
    })));
    if (tech.note) append(el("p", { className: "muted note" }, pick(tech.note)));
    if (!tech.reviewed) append(el("p", { className: "muted note" }, t("draft")));
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
if (frame !== null) { cancelOss(); viewer.time = Math.min(Number(frame), viewer.last); viewer.playing = false; }
