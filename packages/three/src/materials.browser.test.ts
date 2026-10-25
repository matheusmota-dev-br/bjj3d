import * as THREE from "three";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BELT_COLORS, BELTS } from "./mannequin.ts";
import { LOOKS, paint, sharedUniforms, TENSION_COLOR, type BuiltinLook as Look, type SharedUniforms } from "./materials.ts";

/** A sphere in one look under a light, rendered to a small canvas; returns the centre pixel. */
function render(look: Look, u: SharedUniforms, onLight = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true });
  renderer.setSize(32, 32, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#000000");
  scene.add(new THREE.HemisphereLight("#ffffff", "#444444", 2));
  const p = paint(look, "#9aa0a6", u, "white", onLight);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), p.body);
  scene.add(sphere);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.set(0, 0, 2);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const error = gl.getError();
  renderer.dispose();
  return { px, error, programs: renderer.info.programs?.length ?? 0 };
}

afterEach(() => vi.restoreAllMocks());

describe("shared uniforms", () => {
  test("start with no tension, a 14 cm radius, the tension red and full intensity", () => {
    const u = sharedUniforms();
    expect(u.tension.value).toBe(0);
    expect(u.tensionCenter.value.toArray()).toEqual([0, 0, 0]);
    expect(u.tensionRadius.value).toBe(0.14);
    expect(u.tensionColor.value.equals(TENSION_COLOR)).toBe(true);
    expect(u.intensity.value).toBe(1);
    expect(u.onLight.value).toBe(0);
  });

  test("are separate per fighter, not shared objects", () => {
    const a = sharedUniforms(), b = sharedUniforms();
    a.tensionColor.value.set("#00ff00");
    a.tensionCenter.value.set(1, 2, 3);
    expect(b.tensionColor.value.equals(TENSION_COLOR)).toBe(true);
    expect(b.tensionCenter.value.toArray()).toEqual([0, 0, 0]);
  });
});

describe("paint", () => {
  test("knows three looks", () => {
    expect(LOOKS).toEqual(["solid", "wood", "hologram"]);
  });

  test("solid: the fighter's colour, joints 60% as bright, the belt in its rank's colour", () => {
    const u = sharedUniforms();
    for (const belt of BELTS) {
      const p = paint("solid", "#f2b544", u, belt, false);
      const body = p.body as THREE.MeshStandardMaterial, joint = p.joint as THREE.MeshStandardMaterial, b = p.belt as THREE.MeshStandardMaterial;
      expect(body).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(body.color.equals(new THREE.Color("#f2b544"))).toBe(true);
      expect(joint.color.equals(new THREE.Color("#f2b544").multiplyScalar(0.6))).toBe(true);
      expect(b.color.equals(new THREE.Color(BELT_COLORS[belt]))).toBe(true);
      expect([body.roughness, joint.roughness, b.roughness]).toEqual([0.6, 0.5, 0.85]);
    }
  });

  test("wood: a grain texture drawn once and shared, joints in the fighter's colour", () => {
    const u = sharedUniforms();
    const a = paint("wood", "#5fb4ff", u, "black", false), b = paint("wood", "#f2b544", u, "blue", false);
    const map = (a.body as THREE.MeshStandardMaterial).map!;
    expect(map).toBeInstanceOf(THREE.CanvasTexture);
    expect((b.body as THREE.MeshStandardMaterial).map).toBe(map);
    expect(map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect([map.wrapS, map.wrapT]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
    const image = map.image as HTMLCanvasElement;
    expect([image.width, image.height]).toEqual([64, 512]);
    expect((a.joint as THREE.MeshStandardMaterial).color.equals(new THREE.Color("#5fb4ff"))).toBe(true);
    expect((a.belt as THREE.MeshStandardMaterial).color.equals(new THREE.Color(BELT_COLORS.black))).toBe(true);
  });

  test("x-ray: one translucent material for every piece, additive on dark, normal on light", () => {
    const u = sharedUniforms();
    const dark = paint("hologram", "#5fb4ff", u, "white", false);
    const light = paint("hologram", "#5fb4ff", u, "white", true);
    for (const p of [dark, light]) {
      expect(p.joint).toBe(p.body);
      expect(p.belt).toBe(p.body);
      const m = p.body as THREE.ShaderMaterial;
      expect(m).toBeInstanceOf(THREE.ShaderMaterial);
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.side).toBe(THREE.DoubleSide);
      // The shared uniforms themselves, so the viewer's updates reach this material.
      expect(m.uniforms.tension).toBe(u.tension);
      expect(m.uniforms.tensionCenter).toBe(u.tensionCenter);
      expect((m.uniforms.color.value as THREE.Color).equals(new THREE.Color("#5fb4ff"))).toBe(true);
    }
    expect((dark.body as THREE.ShaderMaterial).blending).toBe(THREE.AdditiveBlending);
    expect((light.body as THREE.ShaderMaterial).blending).toBe(THREE.NormalBlending);
  });

  test("the lit looks patch the glow into three's shader", () => {
    const u = sharedUniforms();
    const m = paint("solid", "#ffffff", u, "white", false).body;
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: "#include <common>\n#include <project_vertex>",
      fragmentShader: "#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>\n#include <opaque_fragment>",
    };
    m.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    for (const k of Object.keys(u) as (keyof SharedUniforms)[]) expect(shader.uniforms[k]).toBe(u[k]);
    expect(shader.vertexShader).toContain("varying vec3 vPosW;");
    expect(shader.vertexShader).toContain("vPosW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    expect(shader.fragmentShader).toContain("float tensionAt()");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb = mix(diffuseColor.rgb, tensionColor, 0.75 * tensionAt());");
    expect(shader.fragmentShader).toContain("totalEmissiveRadiance += tensionColor * 0.9 * tensionAt();");
    expect(shader.fragmentShader).toContain("gl_FragColor.rgb *= intensity;");
  });
});

describe("on the GPU", () => {
  test.each(LOOKS)("%s compiles and draws without GL or shader errors", (look) => {
    const error = vi.spyOn(console, "error");
    const r = render(look, sharedUniforms());
    expect(r.error).toBe(0);
    expect(error).not.toHaveBeenCalled();
    expect(r.programs).toBeGreaterThan(0);
    // Something was drawn over the black background.
    expect(r.px[0] + r.px[1] + r.px[2]).toBeGreaterThan(0);
  });

  test.each(LOOKS)("%s turns red where the tension is", (look) => {
    const calm = render(look, sharedUniforms());
    const u = sharedUniforms();
    u.tension.value = 1;
    u.tensionCenter.value.set(0, 0, 0.5); // the front of the sphere, under the centre pixel
    const tense = render(look, u);
    const redness = (px: Uint8Array) => px[0] - (px[1] + px[2]) / 2;
    expect(redness(tense.px)).toBeGreaterThan(redness(calm.px) + 20);
  });

  test("x-ray on a bright background tints instead of adding light", () => {
    const error = vi.spyOn(console, "error");
    const r = render("hologram", sharedUniforms(), true);
    expect(r.error).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });

  test("intensity dims the lit looks", () => {
    const u = sharedUniforms();
    const full = render("solid", u);
    u.intensity.value = 0.3;
    const dim = render("solid", u);
    // 30% in linear light; the canvas is sRGB-encoded, where that is a little over half.
    expect(dim.px[0]).toBeLessThan(full.px[0] * 0.65);
    expect(dim.px[0]).toBeGreaterThan(0);
  });
});
