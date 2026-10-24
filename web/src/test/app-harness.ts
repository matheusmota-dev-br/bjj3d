// Boots the page script (src/main.ts) inside a browser test: the markup of index.html, the
// URL, the saved settings and, optionally, an altered copy of graph.json. main.ts runs once
// per module graph, and every test file gets its own, so a scenario that needs a fresh boot
// lives in a file of its own.

import html from "../../index.html?raw";
import type { GraphFile } from "../data.ts";
import { Viewer, type Frame } from "../viewer.ts";

export const SETTINGS_KEY = "bjj-3d.settings.v2";

export interface BootOptions {
  /** Query string without the graph parameter, e.g. "?debug=1". */
  search?: string;
  hash?: string;
  /** Saved settings: an object, a raw string (to test broken JSON), or nothing saved. */
  settings?: Record<string, unknown> | string | null;
  /** Alters a copy of graph.json, served to the page through ?graph=. */
  graph?: (g: GraphFile) => void;
  /** Runs right before main.ts is imported (stubs that main reads at boot). */
  before?: () => void;
}

/**
 * Software WebGL is slow: the page under test draws into a small canvas, and the viewer's
 * offscreen pictures (filmstrip, panel rows) are stand-ins. What they look like is the
 * viewer's own tests' business; here only their number and reuse matter.
 */
let pictures = 0;
function lighten() {
  const style = document.createElement("style");
  style.textContent = "#view { width: 160px !important; height: 90px !important; inset: auto !important }";
  document.head.append(style);
  Viewer.prototype.thumbnails = function (keys: number[]) { return keys.map(() => `data:image/jpeg;base64,${btoa(`thumb ${++pictures}`)}`); };
  Viewer.prototype.snapshot = function () { return `data:image/jpeg;base64,${btoa(`snap ${++pictures}`)}`; };
}

let graphCache: GraphFile | null = null;
export async function realGraph(): Promise<GraphFile> {
  graphCache ??= await (await fetch("/graph.json")).json();
  return structuredClone(graphCache!);
}

export async function boot(options: BootOptions = {}) {
  lighten();
  const body = /<body>([\s\S]*)<\/body>/.exec(html)![1].replace(/<script[\s\S]*?<\/script>/g, "");
  document.body.innerHTML = body;
  localStorage.clear();
  sessionStorage.removeItem("bjj-3d.editor");
  if (typeof options.settings === "string") localStorage.setItem(SETTINGS_KEY, options.settings);
  else if (options.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(options.settings));

  const query = new URLSearchParams(options.search ?? "?debug=1");
  if (options.graph) {
    const g = await realGraph();
    options.graph(g);
    query.set("graph", URL.createObjectURL(new Blob([JSON.stringify(g)], { type: "application/json" })));
  }
  const search = query.toString();
  history.replaceState(null, "", `${location.pathname}${search ? `?${search}` : ""}${options.hash ? `#${options.hash}` : ""}`);
  options.before?.();
  const main = await import("../main.ts");
  return { main, viewer: (window as unknown as { viewer?: Viewer }).viewer! };
}

/**
 * Stands in for IntersectionObserver (pass it in `before`): a page that is not in front gets
 * no intersection callbacks, so the tests deliver them by hand.
 */
export class ManualObserver {
  static last: ManualObserver;
  readonly observed = new Set<Element>();
  readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) { this.callback = callback; ManualObserver.last = this; }
  observe(e: Element) { this.observed.add(e); }
  unobserve(e: Element) { this.observed.delete(e); }
  disconnect() { this.observed.clear(); }
  /** Reports these elements as in view (or not). */
  deliver(targets: Element[], isIntersecting = true) {
    this.callback(targets.map((target) => ({ target, isIntersecting }) as IntersectionObserverEntry), this as unknown as IntersectionObserver);
  }
}

export const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Goes to a ref and waits for the page to show it. */
export async function go(hash: string) {
  location.hash = hash;
  await new Promise((r) => addEventListener("hashchange", r, { once: true }));
}

/** A frame as the viewer reports it, with defaults for what a test does not care about. */
export function frame(f: Partial<Frame> = {}): Frame {
  return { time: 0, last: 0, reading: null, joint: null, impact: 0, impactStart: false, ...f };
}

/** The index of the first position or transition with this name. */
export function indexOf(g: GraphFile, kind: "positions" | "transitions", name: string) {
  const i = g[kind].findIndex((x) => x.name === name);
  if (i < 0) throw new Error(`no ${kind} named ${name}`);
  return i;
}
