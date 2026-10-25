// Where the fighters are: a competition mat, a gym, a plain studio or the dark grid.
// Everything is drawn here (canvas textures and planes), so nothing is downloaded.

import * as THREE from "three";

/** A place's id: one of the built-ins, or any id a `PlaceDef` adds. */
export type Place = string;
export type BuiltinPlace = "mat" | "gym" | "studio" | "night";
export const PLACES: BuiltinPlace[] = ["mat", "gym", "studio", "night"];
export type Theme = "light" | "dark";

export interface Environment {
  group: THREE.Group;
  background: THREE.Color;
  fog: THREE.Fog | null;
  /** The camera stays inside rooms. */
  maxDistance: number;
  /** Bright surroundings: the x-ray look switches from adding light to tinting. */
  light: boolean;
  /** Sky-light strength for this place. */
  hemi: number;
}

// --- the mat: 1 m interlocking tiles, an 8 × 8 m competition area with a safety border

const TILE = 1;
const AREA = 8;
const BORDER = 1;

function matTexture(): THREE.CanvasTexture {
  const tiles = AREA + 2 * BORDER;
  const px = 96;
  const c = document.createElement("canvas");
  c.width = c.height = tiles * px;
  const g = c.getContext("2d")!;
  for (let i = 0; i < tiles; i++)
    for (let k = 0; k < tiles; k++) {
      const border = i < BORDER || k < BORDER || i >= tiles - BORDER || k >= tiles - BORDER;
      // Each tile a shade off its neighbours, as real mats fade unevenly.
      const jitter = ((i * 7 + k * 13) % 5) - 2;
      g.fillStyle = border ? `hsl(220 10% ${16 + jitter * 0.6}%)` : `hsl(214 52% ${38 + jitter}%)`;
      g.fillRect(i * px, k * px, px, px);
      // Seams and a fine texture of dimples.
      g.strokeStyle = "rgb(0 0 0 / 0.35)";
      g.lineWidth = 2;
      g.strokeRect(i * px + 1, k * px + 1, px - 2, px - 2);
      g.fillStyle = "rgb(255 255 255 / 0.035)";
      for (let d = 0; d < 40; d++) g.fillRect(i * px + ((d * 37) % px), k * px + ((d * 59) % px), 2, 2);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function mat(): THREE.Mesh {
  const size = (AREA + 2 * BORDER) * TILE;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.92 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.receiveShadow = true;
  return m;
}

function floor(color: THREE.ColorRepresentation, size = 60): THREE.Mesh {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  f.rotation.x = -Math.PI / 2;
  f.receiveShadow = true;
  return f;
}

// --- the gym: a room around the mat, padded below and painted above

function wallTexture(paint: string, pad: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 384;
  const g = c.getContext("2d")!;
  g.fillStyle = paint;
  g.fillRect(0, 0, c.width, c.height);
  const padTop = c.height * (1 - 1.4 / 3.6);
  g.fillStyle = pad;
  g.fillRect(0, padTop, c.width, c.height - padTop);
  g.strokeStyle = "rgb(0 0 0 / 0.3)";
  g.lineWidth = 3;
  for (let x = 0; x <= c.width; x += c.width / 12) g.strokeRect(x, padTop, c.width / 12, c.height - padTop);
  g.fillStyle = "rgb(0 0 0 / 0.15)";
  g.fillRect(0, padTop - 6, c.width, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function room(width: number, height: number): THREE.Group {
  const group = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ map: wallTexture("#d9d6cf", "#1f2c44"), roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wall);
    const a = (i * Math.PI) / 2;
    w.position.set(Math.sin(a) * (-width / 2), height / 2, Math.cos(a) * (-width / 2));
    w.rotation.y = a;
    w.receiveShadow = true;
    group.add(w);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, width), new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  group.add(ceiling);
  // Light panels in the ceiling.
  for (const x of [-2.5, 2.5]) for (const z of [-2.5, 2.5]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ color: "#fffdf5" }));
    p.rotation.x = Math.PI / 2;
    p.position.set(x, height - 0.01, z);
    group.add(p);
  }
  return group;
}

// --- the night grid: the original dark look

function nightGrid(): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.MeshBasicMaterial({ color: "#16233a", transparent: true, opacity: 0.7, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  g.add(disc, new THREE.PolarGridHelper(2.4, 8, 6, 64, "#2a3d5c", "#1f2f4a"), shadowCatcher(0.45));
  return g;
}

function shadowCatcher(opacity: number): THREE.Mesh {
  const c = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity }));
  c.rotation.x = -Math.PI / 2;
  c.position.y = 0.003;
  c.receiveShadow = true;
  return c;
}

/** A place the fighters can be in. A new place is one of these, passed to the viewer. */
export interface PlaceDef {
  id: Place;
  build(theme: Theme): Environment;
}

export const builtinPlaces: PlaceDef[] = PLACES.map((id) => ({ id, build: (theme) => buildEnvironment(id, theme) }));

export function buildEnvironment(place: BuiltinPlace, theme: Theme): Environment {
  const group = new THREE.Group();
  const dark = theme === "dark";
  switch (place) {
    case "mat": {
      const ground = dark ? "#1b2029" : "#d7dce3";
      group.add(floor(ground), mat());
      return { group, background: new THREE.Color(ground), fog: new THREE.Fog(ground, 9, 28), maxDistance: 12, light: !dark, hemi: 1.3 };
    }
    case "gym": {
      group.add(floor("#5b5148", 12), mat(), room(12, 3.6));
      return { group, background: new THREE.Color("#2a2a2a"), fog: null, maxDistance: 5.2, light: true, hemi: 1.5 };
    }
    case "studio": {
      // One color for floor, horizon and sky: an endless backdrop, only shadows show depth.
      const tone = dark ? "#2a2e36" : "#eceef1";
      group.add(floor(tone), shadowCatcher(dark ? 0.5 : 0.3));
      return { group, background: new THREE.Color(tone), fog: new THREE.Fog(tone, 8, 24), maxDistance: 12, light: !dark, hemi: dark ? 1.3 : 1.6 };
    }
    case "night":
      group.add(nightGrid());
      return { group, background: new THREE.Color("#0e1726"), fog: null, maxDistance: 12, light: false, hemi: 1.4 };
  }
}
