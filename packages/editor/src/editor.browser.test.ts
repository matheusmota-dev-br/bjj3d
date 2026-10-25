import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import * as THREE from "three";
import { BONES } from "@bjj3d/core/contact";
import { Db } from "@bjj3d/data";
import { host, openEditor } from "./editor.ts";
import { formatBlock, parse } from "@bjj3d/grapplemap";
import { JOINTS, type Joint, type Player, type Pose, type Vec3 } from "@bjj3d/core";
import { Viewer } from "@bjj3d/three";

// One viewer for the whole file (WebGL contexts are few); each test opens and closes the editor.
let viewer: Viewer;
let db: Db;
let canvas: HTMLCanvasElement;

// The dev server's endpoints, faked: what the additions file holds, what was posted, the answer.
let additions = "";
let posted: string[] = [];
let answer: { ok: boolean; log: string } = { ok: true, log: "" };
const realFetch = window.fetch.bind(window);
let onClose: ReturnType<typeof vi.fn>;
let snapshot: ReturnType<typeof vi.spyOn>;

const drawer = () => document.querySelector<HTMLElement>(".editor")!;
const buttons = () => Array.from(drawer().querySelectorAll<HTMLButtonElement>("button"));
const button = (text: string) => {
  const b = buttons().find((x) => x.textContent!.includes(text));
  if (!b) throw new Error(`no button "${text}"`);
  return b;
};
const inputs = () => Array.from(drawer().querySelectorAll<HTMLInputElement>("input"));
const type = (input: HTMLInputElement, value: string) => { input.value = value; input.dispatchEvent(new Event("input")); };
const texts = () => Array.from(drawer().querySelectorAll("p.muted")).map((p) => p.textContent!);
const flush = () => new Promise((r) => setTimeout(r, 20));
/** The editor's live frames (the viewer previews the block itself). */
const frames = () => viewer.currentPoses;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const positionIndex = (name: string) => db.file.positions.findIndex((p) => p.name === name);

function open(lang = "pt-BR") {
  openEditor({ viewer, db, lang: () => lang, onClose: onClose as unknown as () => void });
}

/** Points the camera at `at` from `from` and freezes it there. */
function aim(from: THREE.Vector3, at: THREE.Vector3) {
  viewer.camera.position.copy(from);
  viewer.camera.lookAt(at);
  viewer.camera.updateMatrixWorld();
}
/** Client coordinates of a point in the scene. */
function screen(v: Vec3) {
  const p = new THREE.Vector3(...v).project(viewer.camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}
function pointer(type: string, at: { x: number; y: number }) {
  // The animation loop is stopped, so the handles' world matrices are brought up to date here.
  viewer.scene.updateMatrixWorld();
  canvas.dispatchEvent(new PointerEvent(type, { clientX: at.x, clientY: at.y, bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
}
/** Looks at a joint from outside the body, so no other handle is in front of it. */
function aimAt(player: Player, joint: Joint) {
  const j = new THREE.Vector3(...player[joint]);
  const hips = new THREE.Vector3(...player.LeftHip).add(new THREE.Vector3(...player.RightHip)).multiplyScalar(0.5);
  const out = j.clone().sub(hips).setY(0).normalize();
  aim(j.clone().addScaledVector(out, 0.35).add(new THREE.Vector3(0, 0.25, 0)), j);
}
function drag(from: Vec3, by: { x: number; y: number }) {
  const a = screen(from);
  pointer("pointerdown", a);
  for (let k = 1; k <= 5; k++) pointer("pointermove", { x: a.x + (by.x * k) / 5, y: a.y + (by.y * k) / 5 });
  pointer("pointerup", { x: a.x + by.x, y: a.y + by.y });
}
const flat = (x: number): Player => Object.fromEntries(JOINTS.map((j) => [j, [x, 0, 0]])) as Player;
const block = (name: string, poses: Pose[], extra = "") => formatBlock({ description: [name], tags: [], properties: [], refs: [], poses }) + extra;

beforeAll(async () => {
  document.body.innerHTML = `<main id="stage" style="position:fixed;inset:0"><canvas id="view" style="width:1280px;height:720px;display:block"></canvas></main>`;
  canvas = document.querySelector("#view")!;
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {};
  viewer = new Viewer(canvas);
  // Frozen: no animation loop moving the orbit target between a projection and a click.
  viewer.renderer.setAnimationLoop(null);
  db = await Db.load("/graph.json");
  viewer.show({ poses: db.poses({ type: "t", i: 458, reversed: false }), substeps: db.file.substeps, kind: null, chain: false });
  viewer.time = 2;
  host.reload = vi.fn();
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url === "/__editor/additions") return new Response(additions);
    if (url === "/__editor/save") { posted.push(String(init!.body)); return new Response(JSON.stringify(answer)); }
    return realFetch(url, init);
  });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  additions = "";
  posted = [];
  answer = { ok: true, log: "" };
  onClose = vi.fn();
  sessionStorage.clear();
  (host.reload as ReturnType<typeof vi.fn>).mockClear();
  // Twelve real snapshots take seconds in software WebGL; only the first test needs them.
  snapshot = vi.spyOn(viewer, "snapshot").mockReturnValue("data:image/jpeg;base64,");
});
afterEach(() => {
  snapshot.mockRestore();
  // Whatever the language, the close button is the head's.
  document.querySelector<HTMLButtonElement>(".editor .cz-head button")?.click();
});

describe("the start screen", () => {
  test("offers the neutral positions, with a picture each, in the interface's language", async () => {
    snapshot.mockRestore();
    open();
    const presets = drawer().querySelectorAll<HTMLButtonElement>(".preset");
    expect(presets).toHaveLength(12);
    expect(presets[0].textContent).toBe("Em pé, frente a frente");
    expect(presets[0].querySelector("img")!.src).toMatch(/^data:image\/jpeg;base64,.{100}/);
    expect(drawer().textContent).toContain("Começar de uma posição neutra");
    expect(document.body.classList.contains("studio")).toBe(true);
    expect(viewer.cameraMode).toBe("free");
    await flush();
    expect(drawer().textContent).toContain("nenhuma ainda");
  }, 180_000);

  test("speaks English when the interface does", () => {
    open("en");
    expect(drawer().querySelector(".preset")!.textContent).toBe("Standing, face to face");
    expect(drawer().textContent).toContain("Start from a neutral position");
    button("Close").click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("leaves out a neutral position the database no longer has", async () => {
    const file = { ...db.file, positions: db.file.positions.map((p) => (p.name === "mount" ? { ...p, name: "renamed" } : p)) };
    openEditor({ viewer, db: new Db(file), lang: () => "pt-BR", onClose: onClose as unknown as () => void });
    expect(drawer().querySelectorAll(".preset")).toHaveLength(11);
  });

  test("a neutral position starts a two-frame transition with its tags", () => {
    open();
    drawer().querySelector<HTMLButtonElement>(".preset")!.click();
    const i = positionIndex("staredown");
    expect(frames()).toHaveLength(2);
    expect(frames()[0]).toEqual(db.poses({ type: "p", i })[0]);
    expect(frames()[0]).not.toBe(db.poses({ type: "p", i })[0]);
    expect(inputs()[1].value).toBe(db.file.positions[i].tags.join(" "));
    expect(texts()).toContain(`Primeiro quadro: coincide com "staredown"`);
    expect(texts()).toContain(`Último quadro: coincide com "staredown"`);
  });

  test("searches positions by name, and an empty search clears the list", () => {
    open();
    const search = inputs()[0];
    type(search, "  MOUNT ");
    const results = search.nextElementSibling!.querySelectorAll("button");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);
    type(search, "");
    expect(search.nextElementSibling!.children).toHaveLength(0);
    type(search, "mount");
    const mount = Array.from(search.nextElementSibling!.querySelectorAll("button")).find((b) => b.textContent === "mount")!;
    mount.click();
    expect(frames()[0]).toEqual(db.poses({ type: "p", i: positionIndex("mount") })[0]);
    expect(inputs()[1].value).toBe(db.file.positions[positionIndex("mount")].tags.join(" "));
  });

  test("copies a transition: its keyframes, tags, mover and references", () => {
    open();
    const search = inputs()[1];
    type(search, db.file.transitions[458].name);
    const b = Array.from(search.nextElementSibling!.querySelectorAll("button")).find((x) => x.textContent!.startsWith(db.file.transitions[458].name + " · "))!;
    b.click();
    const tr = db.file.transitions[458];
    const all = db.poses({ type: "t", i: 458, reversed: false });
    expect(frames()).toHaveLength(Math.floor((all.length - 1) / db.file.substeps) + 1);
    expect(frames()[1]).toEqual(all[db.file.substeps]);
    expect(inputs()[0].value).toBe(`cópia de ${tr.name}`);
    expect(inputs()[1].value).toBe(tr.tags.join(" "));
    expect(inputs()[2].value).toBe(tr.refs[0] ?? "");
  });

  test("names unlinked ends with a question mark, and says 'copy of' in English", () => {
    open("en");
    const names = db.file.transitions.map((t) => t.name);
    const i = db.file.transitions.findIndex((t, k) => t.from === null && names.indexOf(t.name) === k && names.lastIndexOf(t.name) === k);
    const search = inputs()[1];
    type(search, db.file.transitions[i].name);
    const b = Array.from(search.nextElementSibling!.querySelectorAll("button")).find((x) => x.textContent!.startsWith(db.file.transitions[i].name + " · ?"))!;
    expect(b).toBeTruthy();
    b.click();
    expect(inputs()[0].value).toBe(`copy of ${db.file.transitions[i].name}`);
  });

  test("an empty transition search clears the list", () => {
    open();
    const search = inputs()[1];
    type(search, "kimura");
    expect(search.nextElementSibling!.children.length).toBeGreaterThan(0);
    type(search, " ");
    expect(search.nextElementSibling!.children).toHaveLength(0);
  });

  test("starts from the frame on screen, as a transition or as a position", () => {
    open();
    const here = viewer.currentPoses[Math.round(viewer.time * db.file.substeps)];
    button("Transição").click();
    expect(frames()).toHaveLength(2);
    expect(frames()[0]).toEqual(here);
    expect(texts().some((t) => t.startsWith("Último quadro"))).toBe(true);
    button("Fechar").click();
    viewer.show({ poses: db.poses({ type: "t", i: 458, reversed: false }), substeps: db.file.substeps, kind: null, chain: false });
    viewer.time = 2;
    open();
    button("Posição").click();
    expect(frames()).toHaveLength(1);
    expect(texts().some((t) => t.startsWith("Último quadro"))).toBe(false);
    expect(texts()).toContain("Primeiro quadro: uma posição nova");
  });

  test("lists the saved additions, and opens one; a block without frames keeps the start screen", async () => {
    const pose = db.poses({ type: "p", i: positionIndex("mount") })[0];
    additions = block("my mount", [pose, pose]) + "\nno frames\ntags: x\n";
    open();
    await flush();
    expect(button("my mount")).toBeTruthy();
    button("no frames").click();
    expect(drawer().querySelector(".preset")).toBeTruthy();
    await flush();
    button("my mount").click();
    expect(inputs()[0].value).toBe("my mount");
    expect(frames()).toHaveLength(2);
  });
});

describe("posing", () => {
  function startFrom(name: string) {
    open();
    type(inputs()[0], name);
    Array.from(inputs()[0].nextElementSibling!.querySelectorAll("button")).find((b) => b.textContent === name)!.click();
  }

  test("dragging a joint moves it and keeps every bone's length", () => {
    startFrom("mount");
    const p = frames()[0][0];
    const before = new Map(BONES.map(([a, b]) => [a + b, dist(p[a], p[b])]));
    const elbow: Vec3 = [...p.LeftElbow];
    aimAt(p, "LeftElbow");
    drag(elbow, { x: 160, y: -120 });
    expect(dist(p.LeftElbow, elbow)).toBeGreaterThan(0.08);
    for (const [a, b] of BONES) expect(Math.abs(dist(p[a], p[b]) - before.get(a + b)!)).toBeLessThan(0.01);
    expect(frames()[1][0].LeftElbow).toEqual(elbow);
    expect(texts()).toContain("Primeiro quadro: uma posição nova");
    expect(viewer.controls.enabled).toBe(true);
  });

  test("a joint dragged below the mat stops on it", () => {
    startFrom("mount");
    const p = frames()[0][1];
    const wrist: Vec3 = [...p.RightWrist];
    aimAt(p, "RightWrist");
    drag(wrist, { x: 0, y: 4000 });
    expect(p.RightWrist[1]).toBeCloseTo(0.02, 5);
  });

  test("the body handle moves the whole body", () => {
    startFrom("mount");
    const p = frames()[0][0];
    const before = Object.fromEntries(JOINTS.map((j) => [j, [...p[j]] as Vec3]));
    const handle: Vec3 = [(p.LeftHip[0] + p.RightHip[0]) / 2, (p.LeftHip[1] + p.RightHip[1]) / 2 + 0.12, (p.LeftHip[2] + p.RightHip[2]) / 2];
    aim(new THREE.Vector3(handle[0], handle[1] + 1.2, handle[2] + 0.01), new THREE.Vector3(...handle));
    drag(handle, { x: 60, y: 0 });
    const shift = p.Head.map((v, i) => v - before.Head[i]);
    expect(Math.hypot(...shift)).toBeGreaterThan(0.02);
    for (const j of JOINTS) for (let i = 0; i < 3; i++) expect(p[j][i] - before[j][i]).toBeCloseTo(shift[i], 6);
  });

  test("bones of zero length and joints under the mat are handled", async () => {
    additions = block("flat", [[flat(0), flat(0.5)]]);
    open();
    await flush();
    button("flat").click();
    aim(new THREE.Vector3(0, 0.6, 0.6), new THREE.Vector3(0, 0, 0));
    drag([0, 0, 0], { x: 40, y: -40 });
    const moved = JOINTS.filter((j) => frames()[0][0][j][1] !== 0);
    expect(moved.length).toBe(JOINTS.length);
    for (const j of JOINTS) expect(frames()[0][0][j][1]).toBeGreaterThanOrEqual(0.02 - 1e-9);
  });

  test("a press on nothing, or before anything is loaded, does not grab", () => {
    open();
    aim(new THREE.Vector3(0, 0.6, 0.6), new THREE.Vector3(0, 0, 0));
    // The handles wait, hidden, at the origin until a block is loaded.
    pointer("pointerdown", screen([0, 0, 0]));
    expect(viewer.controls.enabled).toBe(true);
    pointer("pointerup", screen([0, 0, 0]));
    button("Fechar").click();
    startFrom("mount");
    aim(new THREE.Vector3(5, 5, 5), new THREE.Vector3(6, 6, 6));
    pointer("pointerdown", screen([6, 6, 6]));
    expect(viewer.controls.enabled).toBe(true);
    pointer("pointerup", screen([6, 6, 6]));
  });

  test("hovering a handle enlarges it and shows a grab cursor", () => {
    startFrom("mount");
    const p = frames()[0][0];
    aimAt(p, "LeftElbow");
    pointer("pointermove", screen(p.LeftElbow));
    expect(canvas.style.cursor).toBe("grab");
    const handle = viewer.scene.children.find((c) => c instanceof THREE.Group && c.children.length === 2 * (JOINTS.length + 1))!;
    expect(handle.children.some((m) => m.scale.x === 1.5)).toBe(true);
    pointer("pointermove", screen(p.LeftElbow));
    expect(handle.children.filter((m) => m.scale.x === 1.5)).toHaveLength(1);
    pointer("pointermove", { x: 1, y: 1 });
    expect(canvas.style.cursor).toBe("");
    expect(handle.children.every((m) => m.scale.x === 1)).toBe(true);
    pointer("pointermove", { x: 2, y: 2 });
    expect(canvas.style.cursor).toBe("");
  });

  test("a drag whose plane falls behind the camera is ignored", () => {
    startFrom("mount");
    const p = frames()[0][0];
    const elbow: Vec3 = [...p.LeftElbow];
    aimAt(p, "LeftElbow");
    const at = screen(elbow);
    pointer("pointerdown", at);
    expect(viewer.controls.enabled).toBe(false);
    // Turn around: the drag plane is now behind the camera.
    const eye = viewer.camera.position.clone();
    aim(eye.clone().addScaledVector(new THREE.Vector3(...elbow).sub(eye), 3), eye.clone().addScaledVector(new THREE.Vector3(...elbow).sub(eye), 4));
    pointer("pointermove", { x: at.x + 10, y: at.y });
    expect(p.LeftElbow).toEqual(elbow);
    pointer("pointerup", at);
    expect(viewer.controls.enabled).toBe(true);
  });
});

describe("frames and tools", () => {
  function startFromPreset() {
    open();
    drawer().querySelector<HTMLButtonElement>(".preset")!.click();
  }
  const frameButtons = () => Array.from(drawer().querySelectorAll<HTMLButtonElement>(".seg.wrap button"));

  test("duplicates, selects and deletes frames, never the last one", () => {
    startFromPreset();
    button("Duplicar").click();
    expect(frames()).toHaveLength(3);
    expect(frameButtons().map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]);
    frameButtons()[0].click();
    expect(frameButtons()[0].getAttribute("aria-pressed")).toBe("true");
    button("Apagar").click();
    button("Apagar").click();
    expect(frames()).toHaveLength(1);
    button("Apagar").click();
    expect(frames()).toHaveLength(1);
  });

  test("mirrors, swaps and turns the fighters", () => {
    startFromPreset();
    const before = structuredClone(frames()[0]);
    button("Espelhar").click();
    expect(frames()[0][0].LeftHand[0]).toBeCloseTo(-before[0].RightHand[0], 6);
    button("Espelhar").click();
    button("Trocar lutadores").click();
    expect(frames()[0][0]).toEqual(before[1]);
    button("Trocar lutadores").click();
    const turns = buttons().filter((b) => b.title.startsWith("Girar"));
    expect(turns.map((b) => b.title)).toEqual(["Girar âmbar", "Girar âmbar", "Girar azul", "Girar azul"]);
    turns[1].click();
    const p = frames()[0][0], q = before[0];
    const angle = (v: Player) => Math.atan2(v.Head[0] - (v.LeftHip[0] + v.RightHip[0]) / 2, v.Head[2] - (v.LeftHip[2] + v.RightHip[2]) / 2);
    expect(Math.abs(angle(p) - angle(q))).toBeCloseTo(THREE.MathUtils.degToRad(15), 5);
    expect(p.Head[1]).toBe(q.Head[1]);
    buttons().filter((b) => b.title.startsWith("Girar"))[0].click();
    for (const j of JOINTS) for (let i = 0; i < 3; i++) expect(p[j][i]).toBeCloseTo(q[j][i], 9);
    buttons().filter((b) => b.title.startsWith("Girar"))[3].click();
    expect(frames()[0][1].Head).not.toEqual(before[1].Head);
    buttons().filter((b) => b.title.startsWith("Girar"))[2].click();
  });

  test("appends an existing position where the last frame's fighters are", () => {
    startFromPreset();
    buttons().find((b) => b.title === "Girar âmbar")!.click();
    const last = frames()[1];
    const search = inputs()[3];
    type(search, "mount");
    expect(search.nextElementSibling!.children.length).toBeGreaterThan(0);
    type(search, "");
    expect(search.nextElementSibling!.children).toHaveLength(0);
    type(inputs()[3], "mount");
    Array.from(inputs()[3].nextElementSibling!.querySelectorAll("button")).find((b) => b.textContent === "mount")!.click();
    expect(frames()).toHaveLength(3);
    const added = frames()[2];
    expect(added[0].Head[0]).toBeCloseTo(last[0].Head[0], 6);
    expect(added[0].Head[2]).toBeCloseTo(last[0].Head[2], 6);
    const heading = (p: Pose) => Math.atan2(p[1].Head[0] - p[0].Head[0], p[1].Head[2] - p[0].Head[2]);
    expect(heading(added)).toBeCloseTo(heading(last), 6);
    expect(frameButtons()[2].getAttribute("aria-pressed")).toBe("true");
    expect(texts()).toContain(`Último quadro: coincide com "mount"`);
  });

  test("keeps the name, tags, reference and mover typed", () => {
    startFromPreset();
    type(inputs()[0], "my move");
    type(inputs()[1], "  mount   armbar ");
    type(inputs()[2], "  https://example.org  ");
    const seg = () => Array.from(drawer().querySelectorAll<HTMLButtonElement>(".seg:not(.wrap) button"));
    expect(seg().map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "true"]);
    seg()[0].click();
    expect(seg().map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    expect(inputs()[0].value).toBe("my move");
    expect(inputs()[1].value).toBe("mount armbar");
    expect(inputs()[2].value).toBe("https://example.org");
    type(inputs()[2], "   ");
    seg()[2].click();
    expect(inputs()[2].value).toBe("");
    expect(seg()[2].getAttribute("aria-pressed")).toBe("true");
  });
});

describe("saving", () => {
  const savedBlocks = () => parse(posted.at(-1)!);
  const status = () => texts().at(-1);

  test("does nothing without a name", async () => {
    open();
    drawer().querySelector<HTMLButtonElement>(".preset")!.click();
    type(inputs()[0], "   ");
    button("Salvar").click();
    await flush();
    expect(posted).toHaveLength(0);
  });

  test("recentres the frames, posts the file and reloads on the new block", async () => {
    const pose = db.poses({ type: "p", i: positionIndex("mount") })[0];
    additions = block("other", [pose]) + "\n" + block("my move", [pose]);
    open();
    drawer().querySelector<HTMLButtonElement>(".preset")!.click();
    type(inputs()[0], "my move");
    type(inputs()[1], "standing");
    Array.from(drawer().querySelectorAll<HTMLButtonElement>(".seg:not(.wrap) button"))[0].click();
    type(inputs()[2], "https://example.org");
    button("Salvar").click();
    expect(status()).toBe("Salvando… o grafo é reconstruído (alguns segundos).");
    await flush();
    const blocks = savedBlocks();
    expect(blocks.map((b) => b.name)).toEqual(["other", "my move"]);
    const mine = blocks[1];
    expect(mine.tags).toEqual(["standing"]);
    expect(mine.properties).toEqual(["top"]);
    expect(mine.refs).toEqual(["https://example.org"]);
    expect(mine.poses).toHaveLength(2);
    const all = mine.poses.flatMap((p) => p.flatMap((pl) => Object.values(pl)));
    expect(Math.abs(all.reduce((s, v) => s + v[0], 0) / all.length)).toBeLessThan(0.002);
    expect(Math.abs(all.reduce((s, v) => s + v[2], 0) / all.length)).toBeLessThan(0.002);
    expect(status()).toBe("Salvo. Recarregando.");
    expect(sessionStorage.getItem("bjj3d.editor")).toBe("my move");
    await new Promise((r) => setTimeout(r, 900));
    expect(host.reload).toHaveBeenCalledOnce();
  });

  test("a renamed addition replaces its old block", async () => {
    const pose = db.poses({ type: "p", i: positionIndex("mount") })[0];
    additions = block("old name", [pose]) + "\n" + block("new name", [pose]) + "\n" + block("keep", [pose]);
    open();
    await flush();
    button("old name").click();
    type(inputs()[0], "new name");
    button("Salvar").click();
    await flush();
    expect(savedBlocks().map((b) => b.name)).toEqual(["keep", "new name"]);
    // Let the reload timer fire here, not in the next test.
    await new Promise((r) => setTimeout(r, 900));
  });

  test("shows the build's log when the rebuild fails", async () => {
    answer = { ok: false, log: "build failed: boom" };
    open();
    drawer().querySelector<HTMLButtonElement>(".preset")!.click();
    type(inputs()[0], "broken");
    button("Salvar").click();
    await flush();
    expect(status()).toBe("build failed: boom");
    expect(sessionStorage.getItem("bjj3d.editor")).toBeNull();
    await new Promise((r) => setTimeout(r, 900));
    expect(host.reload).not.toHaveBeenCalled();
  });

  test("after the reload, reopens on the saved block", async () => {
    const pose = db.poses({ type: "p", i: positionIndex("mount") })[0];
    additions = block("just saved", [pose, pose]);
    sessionStorage.setItem("bjj3d.editor", "just saved");
    open();
    await flush();
    expect(sessionStorage.getItem("bjj3d.editor")).toBeNull();
    expect(inputs()[0].value).toBe("just saved");
    expect(frames()).toHaveLength(2);
  });

  test("a saved block that is gone leaves the start screen", async () => {
    sessionStorage.setItem("bjj3d.editor", "gone");
    open();
    await flush();
    expect(drawer().querySelector(".preset")).toBeTruthy();
  });
});

test("closing gives the view back", () => {
  open();
  const handles = viewer.scene.children.length;
  viewer.controls.enabled = false;
  canvas.style.cursor = "grab";
  button("Fechar").click();
  expect(document.querySelector(".editor")).toBeNull();
  expect(viewer.scene.children.length).toBe(handles - 1);
  expect(viewer.controls.enabled).toBe(true);
  expect(canvas.style.cursor).toBe("");
  expect(document.body.classList.contains("studio")).toBe(false);
  expect(onClose).toHaveBeenCalledOnce();
  // Its listeners are gone too: a press no longer grabs.
  pointer("pointerdown", { x: 640, y: 360 });
  expect(viewer.controls.enabled).toBe(true);
  pointer("pointerup", { x: 640, y: 360 });
});
