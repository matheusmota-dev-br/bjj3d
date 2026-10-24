import * as THREE from "three";
import { afterEach, describe, expect, test, vi } from "vitest";
import { buildEnvironment, PLACES, type Place, type Theme } from "./environment.ts";

const THEMES: Theme[] = ["light", "dark"];
const meshes = (g: THREE.Object3D) => { const out: THREE.Mesh[] = []; g.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); }); return out; };
const standard = (m: THREE.Mesh) => m.material as THREE.MeshStandardMaterial;

afterEach(() => vi.restoreAllMocks());

describe("buildEnvironment", () => {
  test("knows four places", () => {
    expect(PLACES).toEqual(["mat", "gym", "studio", "night"]);
  });

  test.each(THEMES)("mat (%s): a floor in the theme's tone and a 10 × 10 m tiled mat, fogged", (theme) => {
    const env = buildEnvironment("mat", theme);
    const ground = theme === "dark" ? "#1b2029" : "#d7dce3";
    const [floor, mat] = env.group.children as THREE.Mesh[];
    expect(standard(floor).color.equals(new THREE.Color(ground))).toBe(true);
    expect((floor.geometry as THREE.PlaneGeometry).parameters.width).toBe(60);
    expect((mat.geometry as THREE.PlaneGeometry).parameters.width).toBe(10);
    expect(mat.position.y).toBeGreaterThan(floor.position.y);
    const tex = standard(mat).map!;
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
    expect((tex.image as HTMLCanvasElement).width).toBe(10 * 96);
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
    // Both lie flat and take shadows.
    for (const m of [floor, mat]) {
      expect(m.rotation.x).toBeCloseTo(-Math.PI / 2, 9);
      expect(m.receiveShadow).toBe(true);
    }
    expect(env.background.equals(new THREE.Color(ground))).toBe(true);
    expect(env.fog).toBeInstanceOf(THREE.Fog);
    expect([env.fog!.near, env.fog!.far]).toEqual([9, 28]);
    expect(env.fog!.color.equals(new THREE.Color(ground))).toBe(true);
    expect(env.maxDistance).toBe(12);
    expect(env.light).toBe(theme === "light");
    expect(env.hemi).toBe(1.3);
  });

  test.each(THEMES)("gym (%s): the mat inside a 12 m room with four walls, a ceiling and four light panels", (theme) => {
    const env = buildEnvironment("gym", theme);
    const [floor, mat, room] = env.group.children;
    expect(((floor as THREE.Mesh).geometry as THREE.PlaneGeometry).parameters.width).toBe(12);
    expect((mat as THREE.Mesh).isMesh).toBe(true);
    expect(room).toBeInstanceOf(THREE.Group);
    const parts = room.children as THREE.Mesh[];
    expect(parts).toHaveLength(9);
    const walls = parts.slice(0, 4);
    // One wall on each side, 6 m from the centre, all sharing the padded wall texture.
    const sides = walls.map((w) => [Math.round(w.position.x), Math.round(w.position.z)].join(","));
    expect(new Set(sides)).toEqual(new Set(["0,-6", "-6,0", "0,6", "6,0"]));
    for (const w of walls) {
      expect(w.position.y).toBeCloseTo(1.8, 9);
      expect(w.material).toBe(walls[0].material);
    }
    expect((standard(walls[0]).map!.image as HTMLCanvasElement).width).toBe(1024);
    expect(parts[4].position.y).toBe(3.6);
    for (const p of parts.slice(5)) {
      expect(p.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(p.position.y).toBeCloseTo(3.59, 9);
    }
    // A room looks the same in both themes: bright, no fog, the camera kept inside.
    expect(env.fog).toBeNull();
    expect(env.light).toBe(true);
    expect(env.maxDistance).toBe(5.2);
    expect(env.hemi).toBe(1.5);
    expect(env.background.equals(new THREE.Color("#2a2a2a"))).toBe(true);
  });

  test.each(THEMES)("studio (%s): one tone for floor, fog and sky, only shadows show depth", (theme) => {
    const env = buildEnvironment("studio", theme);
    const tone = new THREE.Color(theme === "dark" ? "#2a2e36" : "#eceef1");
    const [floor, catcher] = env.group.children as THREE.Mesh[];
    expect(standard(floor).color.equals(tone)).toBe(true);
    expect(env.background.equals(tone)).toBe(true);
    expect(env.fog!.color.equals(tone)).toBe(true);
    expect(catcher.material).toBeInstanceOf(THREE.ShadowMaterial);
    expect((catcher.material as THREE.ShadowMaterial).opacity).toBe(theme === "dark" ? 0.5 : 0.3);
    expect(catcher.receiveShadow).toBe(true);
    expect(env.light).toBe(theme === "light");
    expect(env.hemi).toBe(theme === "dark" ? 1.3 : 1.6);
    expect(env.maxDistance).toBe(12);
  });

  test.each(THEMES)("night (%s): the dark grid whatever the theme", (theme) => {
    const env = buildEnvironment("night", theme);
    const [grid] = env.group.children;
    const [disc, polar, catcher] = grid.children;
    expect(((disc as THREE.Mesh).geometry as THREE.CircleGeometry).parameters.radius).toBe(2.4);
    expect(polar).toBeInstanceOf(THREE.PolarGridHelper);
    expect(((catcher as THREE.Mesh).material as THREE.ShadowMaterial).opacity).toBe(0.45);
    expect(env.background.equals(new THREE.Color("#0e1726"))).toBe(true);
    expect(env.fog).toBeNull();
    expect(env.light).toBe(false);
    expect(env.hemi).toBe(1.4);
  });

  test("every place gets a fresh group, not a shared one", () => {
    expect(buildEnvironment("mat", "dark").group).not.toBe(buildEnvironment("mat", "dark").group);
  });

  test.each(PLACES.flatMap((p) => THEMES.map((t) => [p, t] as [Place, Theme])))("%s / %s renders without GL or shader errors", (place, theme) => {
    const error = vi.spyOn(console, "error");
    const canvas = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(64, 36, false);
    renderer.shadowMap.enabled = true;
    const env = buildEnvironment(place, theme);
    const scene = new THREE.Scene();
    scene.background = env.background;
    scene.fog = env.fog;
    const sun = new THREE.DirectionalLight("#ffffff", 2);
    sun.position.set(1, 4, 2);
    sun.castShadow = true;
    scene.add(env.group, sun, new THREE.HemisphereLight("#ffffff", "#444444", env.hemi));
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 50);
    camera.position.set(2, 2, 3);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    expect(renderer.getContext().getError()).toBe(0);
    expect(error).not.toHaveBeenCalled();
    expect(meshes(env.group).length).toBeGreaterThan(0);
    renderer.dispose();
  });
});
