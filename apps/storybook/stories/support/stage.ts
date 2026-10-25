// A 3D story's stage. Browsers keep about 16 WebGL contexts per page and a docs page shows
// many stories at once, so a stage makes its viewer only while it is on screen and disposes
// it when it scrolls away or leaves the page.

import { addons } from "storybook/preview-api";
import type { Db } from "@bjj3d/data";
import { Viewer, type Frame, type ViewerOptions } from "@bjj3d/three";
import { READING } from "./channel.ts";
import { loadDb } from "./db.ts";

export interface StageOptions {
  height?: number;
  label?: string;
  /** Toolbar globals: theme, place, look. A story can pin any of them. */
  globals: Record<string, string>;
  viewer?: ViewerOptions;
  /** Puts something on the stage once the viewer exists. */
  setup(viewer: Viewer, db: Db): void;
  /** Sends the reading to the "Reading" panel. */
  report?: boolean;
  /**
   * Draw on a page that already has its canvas (the cinema template): `element` is what is
   * watched for visibility, `canvas` is drawn on. Without them the stage makes both.
   */
  element?: HTMLElement;
  canvas?: HTMLCanvasElement;
}

interface Live { element: HTMLElement; viewer: Viewer | null; mount(): void; ownCanvas: boolean }
const live = new Set<Live>();

function release(s: Live) {
  s.viewer?.dispose();
  s.viewer = null;
  if (s.ownCanvas) s.element.querySelector("canvas")?.remove();
}

// Stories that left the page (another story, or the docs page went away).
new MutationObserver(() => {
  for (const s of live) if (!s.element.isConnected) { release(s); live.delete(s); }
}).observe(document.body, { childList: true, subtree: true });

const visibility = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const s = [...live].find((x) => x.element === e.target);
    if (!s) continue;
    if (e.isIntersecting && !s.viewer) s.mount();
    if (!e.isIntersecting && s.viewer) release(s);
  }
}, { rootMargin: "100px" });

export function stage(options: StageOptions): HTMLElement {
  const element = options.element ?? document.createElement("div");
  if (!options.element) {
    element.className = "sb-stage";
    element.style.height = `${options.height ?? 420}px`;
  }
  if (options.label) element.append(Object.assign(document.createElement("span"), { className: "sb-label", textContent: options.label }));
  const s: Live = { element, viewer: null, mount, ownCanvas: !options.canvas };
  live.add(s);

  function mount() {
    const canvas = options.canvas ?? document.createElement("canvas");
    if (!options.canvas) element.prepend(canvas);
    const viewer = new Viewer(canvas, { preserveDrawingBuffer: false, ...options.viewer });
    s.viewer = viewer;
    const g = options.globals;
    viewer.setEnvironment(g.place ?? "mat", (g.theme ?? "dark") as "dark" | "light");
    viewer.setLook(g.look ?? "solid");
    if (options.report) {
      const channel = addons.getChannel();
      viewer.onFrame = (f: Frame) => {
        const kind = viewer.currentKind;
        if (!f.reading || !kind) return channel.emit(READING, null);
        const d = viewer.metrics.get(kind).danger;
        channel.emit(READING, { kind, time: f.time, ...f.reading, unit: d.unit, threshold: `${d.when} ${d.value} ${d.unit === "m" ? "m" : "°"}` });
      };
    }
    loadDb().then((db) => { if (s.viewer === viewer) options.setup(viewer, db); });
  }
  visibility.observe(element);
  return element;
}

/** Plays a transition or shows a position from the database. */
export function play(viewer: Viewer, db: Db, ref: Parameters<Db["poses"]>[0], at?: number) {
  const kind = ref.type === "t" ? db.file.transitions[ref.i].kind : null;
  viewer.show({ poses: db.poses(ref), substeps: ref.type === "t" ? db.file.substeps : 1, kind, chain: false });
  if (at !== undefined) { viewer.time = at; viewer.playing = false; }
  else viewer.playing = true;
}
