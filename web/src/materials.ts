// How the mannequins look. Every look shares the same per-fighter uniforms, so the viewer
// sets the tension glow (a red glow around the attacked joint, 0 to 1) once and whichever
// material is on screen picks it up.

import * as THREE from "three";
import { BELT_COLORS, type Belt, type Paint } from "./mannequin.ts";

export type Look = "solid" | "wood" | "hologram";
export const LOOKS: Look[] = ["solid", "wood", "hologram"];

export const TENSION_COLOR = new THREE.Color("#ff3355");

export interface SharedUniforms {
  tension: { value: number };
  tensionCenter: { value: THREE.Vector3 };
  tensionRadius: { value: number };
  tensionColor: { value: THREE.Color };
  intensity: { value: number };
  /** 1 on a bright background, where the x-ray look tints instead of adding light. */
  onLight: { value: number };
}

export function sharedUniforms(): SharedUniforms {
  return {
    tension: { value: 0 },
    tensionCenter: { value: new THREE.Vector3() },
    tensionRadius: { value: 0.14 },
    tensionColor: { value: TENSION_COLOR.clone() },
    intensity: { value: 1 },
    onLight: { value: 0 },
  };
}

const GLOW = /* glsl */ `
  uniform float tension;
  uniform vec3 tensionCenter;
  uniform float tensionRadius;
  uniform vec3 tensionColor;
  uniform float intensity;
  uniform float onLight;
  varying vec3 vPosW;
  float tensionAt() { return tension * (1.0 - smoothstep(0.0, tensionRadius, distance(vPosW, tensionCenter))); }
`;

// --- x-ray: translucent, bright at the silhouette, added on top of what is behind (or a
// dark tint on bright backgrounds). Additive blending needs no sorting.

const hologramVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const hologramFragment = /* glsl */ `
  uniform vec3 color;
  varying vec3 vNormalW;
  ${GLOW}
  void main() {
    vec3 v = normalize(cameraPosition - vPosW);
    float rim = pow(1.0 - abs(dot(normalize(vNormalW), v)), 2.6);
    float g = tensionAt();
    if (onLight > 0.5) {
      vec3 tint = mix(color * 0.45, tensionColor, g);
      gl_FragColor = vec4(tint, clamp(0.06 + 0.85 * rim + g, 0.0, 1.0) * intensity);
      return;
    }
    vec3 c = color * (0.035 + 0.55 * rim);
    c = mix(c, tensionColor * (0.3 + rim), g) + tensionColor * g * 0.2;
    gl_FragColor = vec4(c * intensity, 1.0);
  }
`;

function hologram(color: THREE.ColorRepresentation, u: SharedUniforms, onLight: boolean) {
  return new THREE.ShaderMaterial({
    vertexShader: hologramVertex,
    fragmentShader: hologramFragment,
    uniforms: { ...u, color: { value: new THREE.Color(color) } },
    transparent: true,
    depthWrite: false,
    blending: onLight ? THREE.NormalBlending : THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// --- lit looks: three's standard material with the glow patched in.

function lit(params: THREE.MeshStandardMaterialParameters, u: SharedUniforms) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvPosW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + GLOW)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, tensionColor, 0.75 * tensionAt());")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += tensionColor * 0.9 * tensionAt();")
      .replace("#include <opaque_fragment>", "#include <opaque_fragment>\ngl_FragColor.rgb *= intensity;");
  };
  return m;
}

let woodGrain: THREE.CanvasTexture | null = null;

/** A light wood with fine, wavy grain, drawn once. */
function grain() {
  if (woodGrain) return woodGrain;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d2ad84";
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < c.height; y += 3) {
    const shade = 0.06 + 0.06 * Math.sin(y * 0.11) + 0.04 * Math.sin(y * 0.37);
    g.fillStyle = `rgb(110 70 35 / ${shade.toFixed(3)})`;
    g.fillRect(0, y, c.width, 2);
  }
  woodGrain = new THREE.CanvasTexture(c);
  woodGrain.colorSpace = THREE.SRGBColorSpace;
  woodGrain.wrapS = woodGrain.wrapT = THREE.RepeatWrapping;
  return woodGrain;
}

/**
 * Materials for one fighter in one look. Solid: the fighter's colour, darker joints.
 * Wood: an artist's mannequin with joints in the fighter's colour. X-ray: one translucent
 * colour. The belt keeps its own colour in the lit looks.
 */
export function paint(look: Look, color: THREE.ColorRepresentation, u: SharedUniforms, belt: Belt, onLight: boolean): Paint {
  if (look === "hologram") {
    const h = hologram(color, u, onLight);
    return { body: h, joint: h, belt: h };
  }
  const c = new THREE.Color(color);
  const beltMat = lit({ color: BELT_COLORS[belt], roughness: 0.85 }, u);
  if (look === "wood") return { body: lit({ map: grain(), roughness: 0.55 }, u), joint: lit({ color: c, roughness: 0.45 }, u), belt: beltMat };
  return { body: lit({ color: c, roughness: 0.6 }, u), joint: lit({ color: c.clone().multiplyScalar(0.6), roughness: 0.5 }, u), belt: beltMat };
}
