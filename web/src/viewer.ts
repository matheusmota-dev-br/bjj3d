// The 3D view: two jointed mannequins placed from GrappleMap poses, a playback clock, the
// tension glow on the attacked joint, and the camera.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { isReoriented, JOINTS, mirror, reorient, type Joint, type Pose } from "./grapplemap.ts";
import { buildEnvironment, type Environment, type Place, type Theme } from "./environment.ts";
import { landmarksFromPlayer, type Landmarks } from "./landmarks.ts";
import { Mannequin, type Belt, type Paint } from "./mannequin.ts";
import { paint, sharedUniforms, type Look, type SharedUniforms } from "./materials.ts";
import { glowPoint, read, SIDED, type Kind, type Reading, type Side } from "./metrics.ts";

/** Player 0 is amber, player 1 blue, for as long as a chain of transitions goes on. */
export const COLORS = ["#f2b544", "#5fb4ff"] as const;
const SECONDS_PER_FRAME = 0.8;

export type CameraMode = "free" | "side" | "top" | "eyes0" | "eyes1";

export interface Clip {
  /** Frames to play; keyframe k is poses[k * substeps]. */
  poses: Pose[];
  substeps: number;
  kind: Kind | null;
  /** Keep the bodies where the previous clip left them (rotated, shifted, mirrored, swapped). */
  chain: boolean;
}

export interface Frame {
  time: number;
  last: number;
  reading: Reading | null;
  /** Screen position of the attacked joint, in CSS pixels. */
  joint: { x: number; y: number } | null;
}

/** What a fighter can be given: thickness and belt. */
export interface Style { build: number; belt: Belt }

interface Fighter {
  mannequin: Mannequin;
  uniforms: SharedUniforms;
  style: Style;
  paints: Partial<Record<Look, Paint>>;
}

/** What the customizing screen looks at. */
export type StudioFocus = "body" | "belt";

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
  readonly controls: OrbitControls;
  readonly canvas: HTMLCanvasElement;
  private fighters: Fighter[];
  private frames: [Landmarks, Landmarks][] = [];
  private poses: Pose[] = [];
  /** The current clip's GrappleMap player 0 is shown as body 1 (a chain may swap them). */
  swapped = false;
  private target: { player: number; side: Side; kind: Kind } | null = null;
  private clock = new THREE.Clock();
  private focus = new THREE.Vector3();
  private key: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private env: Environment | null = null;
  time = 0;
  playing = false;
  speed = 1;
  loop = false;
  mirrored = false;
  look: Look = "solid";
  cameraMode: CameraMode = "free";
  visible: [boolean, boolean] = [true, true];
  onFrame: (f: Frame) => void = () => {};
  private sticks: THREE.LineSegments | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new THREE.Color("#0e1726");
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.hemi = new THREE.HemisphereLight("#dfe8f5", "#24324a", 1.4);
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(1.5, 4, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 10 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    this.key = key;
    const fill = new THREE.DirectionalLight("#9fb8ff", 0.6);
    fill.position.set(-2, 2, -1.5);
    this.scene.add(this.hemi, key, key.target, fill);

    this.fighters = COLORS.map(() => {
      const mannequin = new Mannequin();
      this.scene.add(mannequin.group);
      return { mannequin, uniforms: sharedUniforms(), style: { build: 1, belt: "white" as Belt }, paints: {} };
    });
    this.setLook(this.look);
    addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  /** Draws GrappleMap's stick figures over the mannequins. */
  showSticks(on: boolean) {
    if (on && !this.sticks) {
      const g = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(STICKS.length * 12, 3));
      this.sticks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#ffffff", depthTest: false }));
      this.sticks.renderOrder = 10;
      this.scene.add(this.sticks);
    }
    if (this.sticks) this.sticks.visible = on;
  }

  /** A fighter's thickness and belt. */
  setStyle(i: number, style: Style) {
    const f = this.fighters[i];
    if (f.style.belt !== style.belt) f.paints = {};
    f.style = { ...style };
    f.mannequin.build = style.build;
    this.setLook(this.look);
  }

  /** Puts the fighters somewhere else: a mat, a gym, a studio or the dark grid. */
  setEnvironment(place: Place, theme: Theme) {
    if (this.env) {
      this.scene.remove(this.env.group);
      this.env.group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        for (const mat of [m.material].flat()) { (mat as THREE.MeshStandardMaterial | undefined)?.map?.dispose(); (mat as THREE.Material | undefined)?.dispose(); }
      });
    }
    this.env = buildEnvironment(place, theme);
    this.scene.add(this.env.group);
    this.scene.background = this.env.background;
    this.scene.fog = this.env.fog;
    this.hemi.intensity = this.env.hemi;
    this.controls.maxDistance = this.env.maxDistance;
    // The x-ray look draws differently on bright backgrounds: build it again.
    for (const f of this.fighters) delete f.paints.hologram;
    this.setLook(this.look);
    this.frameCamera(true);
  }

  setLook(look: Look) {
    this.look = look;
    const onLight = !!this.env?.light;
    this.fighters.forEach((f, i) => {
      f.uniforms.onLight.value = onLight ? 1 : 0;
      f.mannequin.paint((f.paints[look] ??= paint(look, COLORS[i], f.uniforms, f.style.belt, onLight)));
      f.mannequin.shadows = look !== "hologram";
    });
  }

  /** Shows a clip, continuing from the current pose when it chains. */
  show(clip: Clip) {
    let poses = clip.poses;
    const previous = this.poses.at(this.time >= this.last ? -1 : Math.round(this.time * this.substeps));
    // The contact solver can move a shared end by a few centimetres more than GrappleMap's
    // own 4 cm tolerance, so chaining matches loosely and fades out what is left.
    const r = clip.chain && previous ? isReoriented(poses[0], previous, 0.1) : null;
    this.swapped = r?.swapPlayers ?? false;
    if (r) poses = poses.map((p) => reorient(p, r));
    else if (this.mirrored) poses = poses.map(mirror);
    this.substeps = clip.substeps;
    this.setPoses(poses, clip.kind);
    this.fadeFrom = r && previous ? previous.map((pl) => landmarksFromPlayer(pl)).map((l, k) => {
      const first = this.frames[0][k];
      const out = {} as Landmarks;
      for (const j of Object.keys(l) as (Joint | "MidHip")[]) out[j] = l[j].clone().sub(first[j]);
      return out;
    }) as [Landmarks, Landmarks] : null;
    this.time = 0;
    this.playing = poses.length > 1;
    if (!r) this.frameCamera(true);
  }

  setMirrored(on: boolean) {
    if (on === this.mirrored) return;
    this.mirrored = on;
    this.setPoses(this.poses.map(mirror), this.target?.kind ?? null);
    this.frameCamera(true);
  }

  private setPoses(poses: Pose[], kind: Kind | null) {
    this.poses = poses;
    this.frames = poses.map((p) => p.map(landmarksFromPlayer) as [Landmarks, Landmarks]);
    this.target = kind ? this.pickTarget(kind) : null;
  }

  /** The attacked player and side: whichever reaches the highest reading over the clip. */
  private pickTarget(kind: Kind) {
    let best = { player: 0, side: "Left" as Side, kind, score: -1 };
    for (const player of [0, 1])
      for (const side of (SIDED[kind] ? ["Left", "Right"] : ["Left"]) as Side[]) {
        const score = this.frames.reduce((s, f) => s + read(kind, f[player], f[1 - player], side).value, 0);
        if (score > best.score) best = { player, side, kind, score };
      }
    return best;
  }

  /** What the chain's join is off by, faded out over the first half keyframe. */
  private fadeFrom: [Landmarks, Landmarks] | null = null;

  /** Frames per keyframe gap; time runs in keyframes so technique steps stay put. */
  private substeps = 1;

  /** The last keyframe. */
  get last() { return Math.max(0, (this.frames.length - 1) / this.substeps); }

  /** Sphere around both bodies over the whole clip. */
  private bounds() {
    const box = new THREE.Box3();
    for (const f of this.frames) for (const l of f) for (const p of Object.values(l)) box.expandByPoint(p);
    return box.getBoundingSphere(new THREE.Sphere());
  }

  /** Camera distance that fits a sphere of this radius in the view, whatever the aspect. */
  private fitDistance(radius: number) {
    const v = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const h = Math.atan(Math.tan(v) * this.camera.aspect);
    // Inside a room the camera stays short of the walls, even if that crops the view.
    return Math.min((radius / Math.sin(Math.min(v, h))) * 1.05, (this.env?.maxDistance ?? 12) - 0.2);
  }

  private radius = 1;

  frameCamera(jump: boolean) {
    if (!this.frames.length || this.studio !== null) return;
    const sphere = this.bounds();
    this.radius = Math.max(sphere.radius, 0.6);
    this.focus.copy(sphere.center);
    if (jump && this.cameraMode === "free") {
      this.controls.target.copy(this.focus);
      const d = this.fitDistance(this.radius);
      const dir = new THREE.Vector3(Math.sin(Math.PI / 4), 0.55, Math.cos(Math.PI / 4)).normalize();
      this.camera.position.copy(this.focus).addScaledVector(dir, d);
    }
  }

  setCamera(mode: CameraMode) {
    this.cameraMode = mode;
    this.controls.enabled = mode === "free";
    // A grappler's view is mostly the opponent at arm's length: a wide lens shows more of it.
    this.camera.fov = mode.startsWith("eyes") ? 80 : 40;
    this.camera.updateProjectionMatrix();
    if (mode === "free") this.frameCamera(true);
  }

  private landmarksAt(keyTime: number, player: number): Landmarks {
    const time = keyTime * this.substeps;
    const last = this.frames.length - 1;
    const i = Math.min(Math.floor(time), Math.max(0, last - 1));
    const u = last === 0 ? 0 : time - i;
    const at = (k: number) => this.frames[THREE.MathUtils.clamp(k, 0, last)][player];
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const out = {} as Landmarks;
    for (const j of [...JOINTS, "MidHip"] as (Joint | "MidHip")[]) {
      const a = p0[j], b = p1[j], c = p2[j], d = p3[j];
      out[j] = new THREE.Vector3(catmull(a.x, b.x, c.x, d.x, u), catmull(a.y, b.y, c.y, d.y, u), catmull(a.z, b.z, c.z, d.z, u));
    }
    const fade = this.fadeFrom && Math.max(0, 1 - keyTime / 0.5);
    if (fade) for (const j of Object.keys(out) as (Joint | "MidHip")[]) out[j].addScaledVector(this.fadeFrom![player][j], fade);
    return out;
  }

  // --- the customizing screen: one fighter alone, standing

  studio: number | null = null;
  /** A standing pose (both players) to show a fighter in while customizing. */
  studioPose: Pose | null = null;
  private studioLandmarks: Landmarks | null = null;
  private camAnim: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t: number } | null = null;
  private studioFocusPart: StudioFocus | null = null;

  setStudio(i: number | null) {
    this.studio = i;
    this.studioFocusPart = null;
    if (i === null || !this.studioPose) {
      this.studio = null;
      this.camAnim = null;
      this.frameCamera(true);
      return;
    }
    // The standing player, moved to the origin and turned to face the camera's side (+z).
    const l = landmarksFromPlayer(this.studioPose[i]);
    const facing = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(l.Neck, l.Core), new THREE.Vector3().subVectors(l.RightHip, l.LeftHip));
    const turn = new THREE.Quaternion().setFromUnitVectors(facing.setY(0).normalize(), new THREE.Vector3(0, 0, 1));
    const shift = new THREE.Vector3(-l.MidHip.x, 0, -l.MidHip.z);
    for (const p of Object.values(l)) p.add(shift).applyQuaternion(turn);
    this.studioLandmarks = l;
    this.setCamera("free");
    this.focusStudio("body", true);
  }

  /** Glides the camera to the whole body, or to the waist for the belt. */
  focusStudio(part: StudioFocus, jump = false) {
    const l = this.studioLandmarks;
    if (this.studio === null || !l || (part === this.studioFocusPart && !jump)) return;
    this.studioFocusPart = part;
    const top = l.Head.y + 0.12;
    const views: Record<StudioFocus, [THREE.Vector3, THREE.Vector3, number]> = {
      body: [new THREE.Vector3(0, top * 0.52, 0), new THREE.Vector3(0.38, 0.12, 1), this.fitDistance(top * 0.6)],
      belt: [l.MidHip.clone().lerp(l.Core, 0.3), new THREE.Vector3(0.3, 0.2, 1), 1.3],
    };
    const [target, dir, dist] = views[part];
    const position = target.clone().addScaledVector(dir.normalize(), dist);
    if (jump) { this.controls.target.copy(target); this.camera.position.copy(position); this.camAnim = null; return; }
    this.camAnim = { from: [this.camera.position.clone(), this.controls.target.clone()], to: [position, target], t: 0 };
  }

  /** Moves the scene's center sideways by this many CSS pixels (for a drawer over the view). */
  private shift = 0;
  setViewShift(px: number) {
    this.shift = document.documentElement.dir === "rtl" ? -px : px;
    this.resize();
  }

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.shift) this.camera.setViewOffset(w, h, -this.shift, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.frameCamera(true);
  }

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.studio !== null) return this.tickStudio(dt);
    if (!this.frames.length) return;
    if (this.playing) {
      this.time += (dt / SECONDS_PER_FRAME) * this.speed;
      if (this.time >= this.last) {
        if (this.loop && this.last > 0) this.time = 0;
        else { this.time = this.last; this.playing = false; }
      }
    }

    const l = [0, 1].map((p) => this.landmarksAt(this.time, p));
    this.fighters.forEach((f, p) => {
      f.mannequin.pose(l[p]);
      f.mannequin.group.visible = this.visible[p];
      f.uniforms.tension.value = 0;
      // Through someone's eyes their own body fills the lens; keep it faint.
      f.uniforms.intensity.value = this.cameraMode === `eyes${p}` ? 0.12 : 1;
    });

    let reading: Reading | null = null;
    let joint: Frame["joint"] = null;
    if (this.target) {
      const { player, side, kind } = this.target;
      reading = read(kind, l[player], l[1 - player], side);
      const pos = glowPoint(kind, l[player], side);
      const u = this.fighters[player].uniforms;
      u.tension.value = this.visible[player] ? reading.value : 0;
      u.tensionCenter.value.copy(pos);
      const s = pos.clone().project(this.camera);
      joint = { x: ((s.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - s.y) / 2) * this.canvas.clientHeight };
    }

    if (this.sticks?.visible) {
      const a = this.sticks.geometry.getAttribute("position") as THREE.BufferAttribute;
      let k = 0;
      for (const p of l) for (const [x, y] of STICKS) { a.setXYZ(k++, p[x].x, p[x].y, p[x].z); a.setXYZ(k++, p[y].x, p[y].y, p[y].z); }
      a.needsUpdate = true;
    }
    const mid = l[0].MidHip.clone().add(l[1].MidHip).multiplyScalar(0.5);
    this.key.target.position.copy(mid);
    this.key.position.copy(mid).add(new THREE.Vector3(1.5, 4, 2));
    this.updateCamera(l);
    this.renderer.render(this.scene, this.camera);
    this.onFrame({ time: this.time, last: this.last, reading, joint });
  }

  private tickStudio(dt: number) {
    this.fighters.forEach((f, p) => {
      const shown = p === this.studio;
      f.mannequin.group.visible = shown;
      if (shown && this.studioLandmarks) f.mannequin.pose(this.studioLandmarks);
      f.uniforms.tension.value = 0;
      f.uniforms.intensity.value = 1;
    });
    if (this.sticks) this.sticks.visible = false;
    if (this.camAnim) {
      const a = this.camAnim;
      a.t = Math.min(1, a.t + dt / 0.7);
      const e = a.t * a.t * (3 - 2 * a.t);
      this.camera.position.lerpVectors(a.from[0], a.to[0], e);
      this.controls.target.lerpVectors(a.from[1], a.to[1], e);
      if (a.t >= 1) this.camAnim = null;
    }
    this.key.target.position.set(0, 0.9, 0);
    this.key.position.set(1.5, 4.9, 2);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(l: Landmarks[]) {
    const c = l[0].MidHip.clone().add(l[1].MidHip).multiplyScalar(0.5);
    switch (this.cameraMode) {
      case "free":
        // Drift the orbit center along when a chain of transitions wanders across the mat.
        this.controls.target.lerp(this.focus, 0.05);
        this.controls.update();
        return;
      case "side": {
        const d = this.fitDistance(this.radius);
        this.camera.position.set(c.x, this.focus.y + 0.15 * d, c.z + d);
        this.camera.lookAt(c.x, this.focus.y, c.z);
        return;
      }
      case "top": {
        this.camera.position.set(c.x, this.fitDistance(this.radius), c.z + 0.01);
        this.camera.lookAt(c.x, 0, c.z);
        return;
      }
      case "eyes0":
      case "eyes1": {
        const me = l[this.cameraMode === "eyes0" ? 0 : 1], other = l[this.cameraMode === "eyes0" ? 1 : 0];
        // From just in front of the face, looking at the opponent's chest.
        const look = other.Core.clone().lerp(other.Neck, 0.4);
        const eye = me.Head.clone().addScaledVector(look.clone().sub(me.Head).normalize(), 0.13);
        this.camera.position.copy(eye);
        this.camera.lookAt(look);
        return;
      }
    }
  }
}

/** GrappleMap's own stick figures, for checking the mannequins against the data. */
const STICKS: [Joint, Joint][] = [
  ["Head", "Neck"], ["Neck", "Core"], ["LeftHip", "RightHip"], ["LeftShoulder", "RightShoulder"],
  ...(["Left", "Right"] as const).flatMap((s) => [
    [`${s}Shoulder`, `${s}Elbow`], [`${s}Elbow`, `${s}Wrist`], [`${s}Wrist`, `${s}Hand`], [`${s}Hand`, `${s}Fingers`],
    [`${s}Hip`, `${s}Knee`], [`${s}Knee`, `${s}Ankle`], [`${s}Ankle`, `${s}Heel`], [`${s}Heel`, `${s}Toe`], [`${s}Ankle`, `${s}Toe`],
    [`${s}Hip`, "Core"], [`${s}Shoulder`, "Neck"],
  ] as [Joint, Joint][]),
];

function catmull(p0: number, p1: number, p2: number, p3: number, u: number) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
