// The local editor: new positions and transitions in GrappleMap's own format, posed by
// dragging the joints of the two mannequins. Loaded only by `vite` (dev); it talks to the
// dev server's /__editor endpoints, which write data/grapplemap/bjj-3d.txt and rebuild
// graph.json. Nothing of it is in a build.

import * as THREE from "three";
import { BONES } from "./contact.ts";
import type { Db } from "./data.ts";
import { formatBlock, isReoriented, JOINTS, mirror, parse, reorient, type Block, type Joint, type Pose, type Vec3 } from "./grapplemap.ts";
import { currentLang } from "./i18n.ts";
import type { Viewer } from "./viewer.ts";

type Text = { en: string; "pt-BR": string };
const S = {
  title: { en: "Editor (local)", "pt-BR": "Editor (local)" },
  close: { en: "Close", "pt-BR": "Fechar" },
  presets: { en: "Start from a neutral position", "pt-BR": "Começar de uma posição neutra" },
  fromPosition: { en: "Start from any position", "pt-BR": "Começar de qualquer posição" },
  fromTransition: { en: "Edit a copy of a transition", "pt-BR": "Editar uma cópia de uma transição" },
  searchTransitions: { en: "Search transitions…", "pt-BR": "Buscar transições…" },
  fromScreen: { en: "Or from the frame on screen", "pt-BR": "Ou do quadro na tela" },
  newTransition: { en: "Transition", "pt-BR": "Transição" },
  newPosition: { en: "Position", "pt-BR": "Posição" },
  load: { en: "Saved additions", "pt-BR": "Adições salvas" },
  copyOf: { en: "copy of", "pt-BR": "cópia de" },
  none: { en: "none yet", "pt-BR": "nenhuma ainda" },
  name: { en: "Name", "pt-BR": "Nome" },
  tags: { en: "Tags (space separated, GrappleMap's)", "pt-BR": "Etiquetas (separadas por espaço, as do GrappleMap)" },
  mover: { en: "Who moves", "pt-BR": "Quem executa" },
  ref: { en: "Reference (source, link)", "pt-BR": "Referência (fonte, link)" },
  frames: { en: "Frames", "pt-BR": "Quadros" },
  dup: { en: "Duplicate", "pt-BR": "Duplicar" },
  del: { en: "Delete", "pt-BR": "Apagar" },
  tools: { en: "Pose", "pt-BR": "Pose" },
  mirrorAll: { en: "Mirror", "pt-BR": "Espelhar" },
  swap: { en: "Swap fighters", "pt-BR": "Trocar lutadores" },
  turn: { en: "Turn {who}", "pt-BR": "Girar {who}" },
  ends: { en: "Ends", "pt-BR": "Extremos" },
  first: { en: "First frame", "pt-BR": "Primeiro quadro" },
  last: { en: "Last frame", "pt-BR": "Último quadro" },
  matches: { en: "matches", "pt-BR": "coincide com" },
  newPos: { en: "a new position", "pt-BR": "uma posição nova" },
  appendPos: { en: "Append an existing position as the last frame", "pt-BR": "Acrescentar uma posição existente como último quadro" },
  search: { en: "Search positions…", "pt-BR": "Buscar posições…" },
  save: { en: "Save and rebuild", "pt-BR": "Salvar e reconstruir" },
  saving: { en: "Saving… the graph is rebuilt (a few seconds).", "pt-BR": "Salvando… o grafo é reconstruído (alguns segundos)." },
  saved: { en: "Saved. Reloading.", "pt-BR": "Salvo. Recarregando." },
  hint: { en: "Drag a joint; the big handle moves the whole body. Bone lengths are kept.", "pt-BR": "Arraste uma junta; a bola grande move o corpo inteiro. O comprimento dos ossos é mantido." },
  amber: { en: "amber", "pt-BR": "âmbar" },
  blue: { en: "blue", "pt-BR": "azul" },
  top: { en: "top", "pt-BR": "de cima" },
  bottom: { en: "bottom", "pt-BR": "de baixo" },
  both: { en: "either", "pt-BR": "qualquer" },
} satisfies Record<string, Text>;
const t = (k: keyof typeof S, vars: Record<string, string> = {}) => (S[k][currentLang() === "pt-BR" ? "pt-BR" : "en"]).replace(/\{(\w+)\}/g, (_, v) => vars[v]);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown>, ...kids: (Node | string | null)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "style" || k.startsWith("aria-") || k.startsWith("data-")) e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  e.append(...kids.filter((x): x is Node | string => x !== null));
  return e;
}

const COLORS = ["#f2b544", "#5fb4ff"];
/** What the editor does to the page itself; tests replace it. */
export const host = { reload: location.reload.bind(location) };
const clone = (p: Pose): Pose => JSON.parse(JSON.stringify(p));
const xzAngle = (v: Vec3) => Math.atan2(v[0], v[2]);
function yrot(v: Vec3, a: number): Vec3 { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[2], v[1], s * v[0] + c * v[2]]; }

/** Nudges a player's joints until every bone has its rest length again, the dragged joint fixed. */
function relax(player: Record<Joint, Vec3>, lengths: Map<string, number>, pinned: Joint | null) {
  for (let it = 0; it < 40; it++) {
    for (const [a, b] of BONES) {
      const L = lengths.get(a + b)!;
      const pa = player[a], pb = player[b];
      const d = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
      const len = Math.hypot(...d) || 1e-6;
      const k = (len - L) / len;
      const wa = a === pinned ? 0 : b === pinned ? 1 : 0.5, wb = 1 - wa;
      for (let i = 0; i < 3; i++) { pa[i] += d[i] * k * wa; pb[i] -= d[i] * k * wb; }
    }
    for (const j of JOINTS) if (j !== pinned && player[j][1] < 0.02) player[j][1] = 0.02;
  }
}

export function openEditor(ctx: { viewer: Viewer; db: Db; onClose: () => void }) {
  const { viewer, db } = ctx;
  const file = db.file;

  // --- the block being edited
  let block: Pick<Block, "description" | "tags" | "properties" | "refs" | "poses"> = { description: [""], tags: [], properties: [], refs: [], poses: [] };
  let frame = 0;
  let originalName: string | null = null;

  // --- handles: one small ball per joint, one big ball per body, per fighter
  const handles = new THREE.Group();
  const balls: { mesh: THREE.Mesh; player: number; joint: Joint | "body" }[] = [];
  const ballGeo = new THREE.SphereGeometry(0.022, 12, 8), bodyGeo = new THREE.SphereGeometry(0.04, 12, 8);
  for (const player of [0, 1]) {
    const mat = new THREE.MeshBasicMaterial({ color: COLORS[player], depthTest: false, transparent: true, opacity: 0.85 });
    for (const joint of JOINTS) { const mesh = new THREE.Mesh(ballGeo, mat); mesh.renderOrder = 20; handles.add(mesh); balls.push({ mesh, player, joint }); }
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", depthTest: false, transparent: true, opacity: 0.6 }));
    body.renderOrder = 20; handles.add(body); balls.push({ mesh: body, player, joint: "body" });
  }
  viewer.scene.add(handles);

  function sync() {
    const pose = block.poses[frame];
    for (const b of balls) {
      if (!pose) { b.mesh.visible = false; continue; }
      b.mesh.visible = true;
      const p = pose[b.player];
      const v = b.joint === "body" ? [(p.LeftHip[0] + p.RightHip[0]) / 2, (p.LeftHip[1] + p.RightHip[1]) / 2 + 0.12, (p.LeftHip[2] + p.RightHip[2]) / 2] : p[b.joint];
      b.mesh.position.set(v[0], v[1], v[2]);
    }
    if (pose) viewer.preview(block.poses, frame);
    render();
  }

  // --- dragging
  const canvas = viewer.canvas;
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let drag: { ball: (typeof balls)[number]; plane: THREE.Plane; lengths: Map<string, number>; start: Vec3 } | null = null;
  let hovered: THREE.Mesh | null = null;
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, viewer.camera);
    const hit = ray.intersectObjects(balls.map((b) => b.mesh))[0];
    return hit ? balls.find((b) => b.mesh === hit.object)! : null;
  };
  const onDown = (e: PointerEvent) => {
    const ball = pick(e);
    if (!ball || !block.poses[frame]) return;
    e.stopPropagation();
    const p = block.poses[frame][ball.player];
    const lengths = new Map(BONES.map(([a, b]) => [a + b, Math.hypot(p[b][0] - p[a][0], p[b][1] - p[a][1], p[b][2] - p[a][2])]));
    const normal = viewer.camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, ball.mesh.position);
    const start: Vec3 = [ball.mesh.position.x, ball.mesh.position.y, ball.mesh.position.z];
    drag = { ball, plane, lengths, start };
    viewer.controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) {
      const b = pick(e);
      if (hovered && hovered !== b?.mesh) hovered.scale.setScalar(1);
      hovered = b?.mesh ?? null;
      if (hovered) hovered.scale.setScalar(1.5);
      canvas.style.cursor = hovered ? "grab" : "";
      return;
    }
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, viewer.camera);
    const hit = ray.ray.intersectPlane(drag.plane, new THREE.Vector3());
    if (!hit) return;
    const p = block.poses[frame][drag.ball.player];
    if (drag.ball.joint === "body") {
      const d = [hit.x - drag.ball.mesh.position.x, hit.y - drag.ball.mesh.position.y, hit.z - drag.ball.mesh.position.z];
      for (const j of JOINTS) for (let i = 0; i < 3; i++) p[j][i] += d[i];
    } else {
      p[drag.ball.joint] = [hit.x, Math.max(0.02, hit.y), hit.z];
      relax(p, drag.lengths, drag.ball.joint);
    }
    sync();
  };
  const onUp = (e: PointerEvent) => {
    if (!drag) return;
    drag = null;
    viewer.controls.enabled = true;
    canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener("pointerdown", onDown, true);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);

  // --- the drawer
  const drawer = el("aside", { className: "customizer editor" });
  document.querySelector("#stage")!.append(drawer);
  document.body.classList.add("studio");
  viewer.setCamera("free");
  viewer.playing = false;

  const matchName = (pose: Pose) => {
    const i = file.positions.findIndex((p) => isReoriented(db.poses({ type: "p", i: file.positions.indexOf(p) })[0], pose));
    return i < 0 ? t("newPos") : `${t("matches")} "${file.positions[i].name}"`;
  };

  function turn(player: number, degrees: number) {
    const p = block.poses[frame][player];
    const c: Vec3 = [(p.LeftHip[0] + p.RightHip[0]) / 2, 0, (p.LeftHip[2] + p.RightHip[2]) / 2];
    for (const j of JOINTS) { const r = yrot([p[j][0] - c[0], 0, p[j][2] - c[2]], THREE.MathUtils.degToRad(degrees)); p[j] = [r[0] + c[0], p[j][1], r[2] + c[2]]; }
    sync();
  }

  /** The chosen position, placed where the current last frame's heads are. */
  function appendPosition(i: number) {
    const a = db.poses({ type: "p", i })[0];
    const b = block.poses[block.poses.length - 1];
    // yrot turns a heading by -angle, so the angle is the chosen position's heading minus the frame's.
    const angle = xzAngle([a[1].Head[0] - a[0].Head[0], 0, a[1].Head[2] - a[0].Head[2]]) - xzAngle([b[1].Head[0] - b[0].Head[0], 0, b[1].Head[2] - b[0].Head[2]]);
    const r0 = yrot(a[0].Head, angle);
    const offset: Vec3 = [b[0].Head[0] - r0[0], 0, b[0].Head[2] - r0[2]];
    block.poses.push(reorient(a, { offset, angle, mirror: false, swapPlayers: false }));
    frame = block.poses.length - 1;
    sync();
  }

  async function save() {
    status.textContent = t("saving");
    // Keep both bodies near the origin: the format only holds -2..2 m.
    const all = block.poses.flatMap((p) => p.flatMap((pl) => Object.values(pl)));
    const cx = all.reduce((s, v) => s + v[0], 0) / all.length, cz = all.reduce((s, v) => s + v[2], 0) / all.length;
    for (const p of block.poses) for (const pl of p) for (const j of JOINTS) { pl[j][0] -= cx; pl[j][2] -= cz; }
    const text = await (await fetch("/__editor/additions")).text();
    const blocks = parse(text).filter((b) => b.name !== (originalName ?? block.description[0]) && b.name !== block.description[0]);
    const out = [...blocks.map((b) => formatBlock(b)), formatBlock(block)].join("\n");
    const res = await (await fetch("/__editor/save", { method: "POST", body: out })).json();
    status.textContent = res.ok ? t("saved") : res.log;
    if (res.ok) { sessionStorage.setItem("bjj-3d.editor", block.description[0]); setTimeout(() => host.reload(), 800); }
  }

  const status = el("p", { className: "muted" }, t("hint"));

  function render() {
    const pose = block.poses[frame];
    const nameInput = el("input", { value: block.description[0], placeholder: t("name") }) as HTMLInputElement;
    nameInput.oninput = () => (block.description[0] = nameInput.value);
    const tagInput = el("input", { value: block.tags.join(" "), placeholder: "closed_guard armbar" }) as HTMLInputElement;
    tagInput.oninput = () => (block.tags = tagInput.value.trim().split(/\s+/).filter(Boolean));
    const refInput = el("input", { value: block.refs[0] ?? "", placeholder: "https://…" }) as HTMLInputElement;
    refInput.oninput = () => (block.refs = refInput.value.trim() ? [refInput.value.trim()] : []);
    const who = (v: string, label: string) => {
      const b = el("button", { type: "button", "aria-pressed": String((block.properties[0] ?? "") === v) }, label);
      b.onclick = () => { block.properties = v ? [v] : []; render(); };
      return b;
    };
    const frameBtns = block.poses.map((_, i) => {
      const b = el("button", { type: "button", "aria-pressed": String(i === frame) }, String(i + 1));
      b.onclick = () => { frame = i; sync(); };
      return b;
    });
    const dup = el("button", { type: "button", className: "chip-btn" }, `⧉ ${t("dup")}`);
    dup.onclick = () => { block.poses.splice(frame + 1, 0, clone(block.poses[frame])); frame++; sync(); };
    const del = el("button", { type: "button", className: "chip-btn" }, `✕ ${t("del")}`);
    del.onclick = () => { if (block.poses.length > 1) { block.poses.splice(frame, 1); frame = Math.max(0, frame - 1); sync(); } };
    const mirrorBtn = el("button", { type: "button", className: "chip-btn" }, t("mirrorAll"));
    mirrorBtn.onclick = () => { block.poses = block.poses.map(mirror); sync(); };
    const swapBtn = el("button", { type: "button", className: "chip-btn" }, t("swap"));
    swapBtn.onclick = () => { block.poses = block.poses.map((p) => [p[1], p[0]] as Pose); sync(); };
    const turns = [0, 1].flatMap((pl) => [-15, 15].map((d) => {
      const b = el("button", { type: "button", className: "chip-btn" }, el("span", { className: "dot", style: `background:${COLORS[pl]};margin-inline-end:4px` }), d < 0 ? "⟲" : "⟳");
      b.title = t("turn", { who: pl === 0 ? t("amber") : t("blue") });
      b.onclick = () => turn(pl, d);
      return b;
    }));
    const search = el("input", { placeholder: t("search") }) as HTMLInputElement;
    const results = el("div", { className: "choices" });
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      results.replaceChildren(...(q ? file.positions.map((p, i) => [p, i] as const).filter(([p]) => p.name.toLowerCase().includes(q)).slice(0, 8).map(([p, i]) => {
        const b = el("button", { type: "button" }, p.name);
        b.onclick = () => appendPosition(i);
        return b;
      }) : []));
    };
    const saveBtn = el("button", { type: "button", className: "primary" }, t("save"));
    saveBtn.onclick = () => { if (block.description[0].trim()) save(); };
    const closeBtn = el("button", { type: "button", className: "chip-btn" }, t("close"));
    closeBtn.onclick = close;

    drawer.replaceChildren(
      el("div", { className: "cz-head" }, el("h2", {}, t("title")), closeBtn),
      el("div", { className: "cz-body" },
        ...(pose ? [] : starters()),
        pose ? el("h3", {}, t("name")) : null, pose ? nameInput : null,
        pose ? el("h3", {}, t("tags")) : null, pose ? tagInput : null,
        pose ? el("h3", {}, t("mover")) : null,
        pose ? el("div", { className: "seg" }, who("top", t("top")), who("bottom", t("bottom")), who("", t("both"))) : null,
        pose ? el("h3", {}, t("ref")) : null, pose ? refInput : null,
        pose ? el("h3", {}, t("frames")) : null,
        pose ? el("div", { className: "seg wrap" }, ...frameBtns) : null,
        pose ? el("div", { className: "cz-actions" }, dup, del) : null,
        pose ? el("h3", {}, t("tools")) : null,
        pose ? el("div", { className: "choices" }, mirrorBtn, swapBtn, ...turns) : null,
        pose ? el("h3", {}, t("ends")) : null,
        pose ? el("p", { className: "muted" }, `${t("first")}: ${matchName(block.poses[0])}`) : null,
        pose && block.poses.length > 1 ? el("p", { className: "muted" }, `${t("last")}: ${matchName(block.poses[block.poses.length - 1])}`) : null,
        pose ? el("h3", {}, t("appendPos")) : null, pose ? search : null, pose ? results : null,
        pose ? el("div", { className: "cz-actions" }, saveBtn) : null,
        status),
    );
  }

  /** Named positions of the database to start from: the best-connected one of each family. */
  const PRESETS: [string, Text][] = [
    ["staredown", { en: "Standing, face to face", "pt-BR": "Em pé, frente a frente" }],
    ["symmetric staggered standing", { en: "Standing, tied up", "pt-BR": "Em pé, pegada trocada" }],
    ["distance closed guard", { en: "Closed guard", "pt-BR": "Guarda fechada" }],
    ["half guard shell", { en: "Half guard", "pt-BR": "Meia-guarda" }],
    ["distance seated butterfly", { en: "Butterfly guard", "pt-BR": "Guarda borboleta" }],
    ["knee slice vs t-rex", { en: "Combat base (passing)", "pt-BR": "Base de combate (passagem)" }],
    ["side ctrl w/ near open elbow and crossface", { en: "Side control", "pt-BR": "Cem quilos" }],
    ["knee on belly center", { en: "Knee on belly", "pt-BR": "Joelho na barriga" }],
    ["mount", { en: "Mount", "pt-BR": "Montada" }],
    ["north south", { en: "North-south", "pt-BR": "Norte-sul" }],
    ["parallel turtle", { en: "Turtle", "pt-BR": "Tartaruga" }],
    ["turtle w/ seatbelt and near hook", { en: "Back (seatbelt)", "pt-BR": "Costas (cinto)" }],
  ];

  const fresh = (poses: Pose[], meta: Partial<typeof block> = {}) => {
    block = { description: [""], tags: [], properties: [], refs: [], ...meta, poses: poses.map(clone) };
    frame = 0;
    originalName = null;
    sync();
  };
  const positionPose = (i: number) => db.poses({ type: "p", i })[0];
  /** A transition's keyframes (graph.json holds the solved, densified frames). */
  const transitionKeys = (i: number) => db.poses({ type: "t", i, reversed: false }).filter((_, k) => k % file.substeps === 0);

  /** Before anything is loaded: presets, a position or transition from the database, the frame on screen, saved additions. */
  function starters(): HTMLElement[] {
    const lang = currentLang() === "pt-BR" ? "pt-BR" : "en";
    const presetCards = PRESETS.flatMap(([name, label]) => {
      const i = file.positions.findIndex((p) => p.name === name);
      if (i < 0) return [];
      const card = el("button", { type: "button", className: "preset" }, el("img", { src: viewer.snapshot(positionPose(i), null, 192, 108), alt: "" }), el("span", {}, label[lang]));
      card.onclick = () => fresh([positionPose(i), positionPose(i)], { tags: [...file.positions[i].tags] });
      return [card];
    });

    const posSearch = el("input", { placeholder: t("search") }) as HTMLInputElement;
    const posResults = el("div", { className: "choices" });
    posSearch.oninput = () => {
      const q = posSearch.value.trim().toLowerCase();
      posResults.replaceChildren(...(q ? file.positions.map((p, i) => [p, i] as const).filter(([p]) => p.name.toLowerCase().includes(q)).slice(0, 8).map(([p, i]) => {
        const b = el("button", { type: "button" }, p.name);
        b.onclick = () => fresh([positionPose(i), positionPose(i)], { tags: [...p.tags] });
        return b;
      }) : []));
    };

    const trSearch = el("input", { placeholder: t("searchTransitions") }) as HTMLInputElement;
    const trResults = el("div", { className: "choices" });
    trSearch.oninput = () => {
      const q = trSearch.value.trim().toLowerCase();
      const name = (i: number | null) => (i === null ? "?" : file.positions[i].name);
      trResults.replaceChildren(...(q ? file.transitions.map((tr, i) => [tr, i] as const).filter(([tr]) => `${tr.name} ${name(tr.from)} ${name(tr.to)}`.toLowerCase().includes(q)).slice(0, 8).map(([tr, i]) => {
        const b = el("button", { type: "button" }, `${tr.name} · ${name(tr.from)} → ${name(tr.to)}`);
        b.onclick = () => fresh(transitionKeys(i), { description: [`${t("copyOf")} ${tr.name}`], tags: [...tr.tags], properties: [...tr.properties], refs: [...tr.refs] });
        return b;
      }) : []));
    };

    const current = viewer.currentPoses;
    const here = current[Math.min(current.length - 1, Math.round(viewer.time * file.substeps))];
    const nt = el("button", { type: "button", className: "chip-btn" }, t("newTransition"));
    nt.onclick = () => fresh([here, here]);
    const np = el("button", { type: "button", className: "chip-btn" }, t("newPosition"));
    np.onclick = () => fresh([here]);

    const list = el("div", { className: "choices" }, el("span", { className: "muted" }, t("none")));
    fetch("/__editor/additions").then((r) => r.text()).then((text) => {
      const blocks = parse(text);
      if (!blocks.length) return;
      list.replaceChildren(...blocks.map((b) => {
        const btn = el("button", { type: "button" }, b.name);
        btn.onclick = () => { block = { description: b.description, tags: b.tags, properties: b.properties, refs: b.refs, poses: b.poses.map(clone) }; originalName = b.name; frame = 0; sync(); };
        return btn;
      }));
    });
    return [
      el("h3", {}, t("presets")), el("div", { className: "presets" }, ...presetCards),
      el("h3", {}, t("fromPosition")), posSearch, posResults,
      el("h3", {}, t("fromTransition")), trSearch, trResults,
      el("h3", {}, t("fromScreen")), el("div", { className: "cz-actions" }, nt, np),
      el("h3", {}, t("load")), list,
    ];
  }

  function close() {
    canvas.removeEventListener("pointerdown", onDown, true);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    viewer.scene.remove(handles);
    viewer.controls.enabled = true;
    canvas.style.cursor = "";
    drawer.remove();
    document.body.classList.remove("studio");
    ctx.onClose();
  }

  // Reopen on the block just saved, after the reload.
  const reopen = sessionStorage.getItem("bjj-3d.editor");
  render();
  if (reopen) {
    sessionStorage.removeItem("bjj-3d.editor");
    fetch("/__editor/additions").then((r) => r.text()).then((text) => {
      const b = parse(text).find((x) => x.name === reopen);
      if (b) { block = { description: b.description, tags: b.tags, properties: b.properties, refs: b.refs, poses: b.poses.map(clone) }; originalName = b.name; frame = 0; sync(); }
    });
  }
}
