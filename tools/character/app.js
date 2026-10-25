// docs/character.html: the site's mannequin (packages/three/src/mannequin.ts) in a T-pose built
// from GrappleMap's proportions and in a few solved positions, next to the five reference views
// its pieces were measured from. Bundled by tools/character.mjs.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BELTS, Mannequin } from "../../packages/three/src/mannequin.ts";
import { LOOKS, paint, sharedUniforms } from "../../packages/three/src/materials.ts";
import { buildEnvironment } from "../../packages/three/src/environment.ts";
import { landmarksFromPlayer } from "../../packages/metrics/src/landmarks.ts";
import { JOINTS } from "../../packages/core/src/pose.ts";
import { decodePose } from "../../packages/grapplemap/src/grapplemap.ts";

// Median lengths over every GrappleMap position (metres). They vary by less than 0.5 cm:
// GrappleMap has one body, so one T-pose describes every figure in it.
const DIMS = {
  shin: 0.429, thigh: 0.431, upperArm: 0.29, foreArm: 0.265, wristHand: 0.081, wristFingers: 0.14,
  heelToe: 0.23, hipWidth: 0.23, shoulderWidth: 0.328, midHipCore: 0.244, coreNeck: 0.385, neckHead: 0.166, neckShoulderDrop: 0.062,
};

/** A T-pose facing +z: legs straight, arms level, the wearer's left on +x, fingers a little down. */
function tPose() {
  const D = DIMS, p = {};
  for (const [s, x] of [["Left", D.hipWidth / 2], ["Right", -D.hipWidth / 2]]) {
    // Foot: heel and toe on the floor line, the ankle where both distances hold.
    p[s + "Heel"] = [x, 0.03, -0.05];
    p[s + "Toe"] = [x, 0.03, 0.18];
    p[s + "Ankle"] = [x, 0.095, 0.012];
    p[s + "Knee"] = [x, 0.095 + D.shin, 0.012];
    p[s + "Hip"] = [x, 0.095 + D.shin + D.thigh, 0.012];
  }
  p.Core = [0, p.LeftHip[1] + Math.sqrt(D.midHipCore ** 2 - 0.03 ** 2), -0.018];
  p.Neck = [0, p.Core[1] + Math.sqrt(D.coreNeck ** 2 - 0.035 ** 2), 0.017];
  p.Head = [0, p.Neck[1] + Math.sqrt(D.neckHead ** 2 - 0.045 ** 2), 0.062];
  for (const [s, dir] of [["Left", 1], ["Right", -1]]) {
    const sh = [dir * D.shoulderWidth / 2, p.Neck[1] - D.neckShoulderDrop, 0.017];
    const along = (d, down = 0) => [sh[0] + dir * d, sh[1] - down, sh[2]];
    p[s + "Shoulder"] = sh;
    p[s + "Elbow"] = along(D.upperArm);
    p[s + "Wrist"] = along(D.upperArm + D.foreArm);
    p[s + "Hand"] = along(D.upperArm + D.foreArm + D.wristHand, 0.008);
    p[s + "Fingers"] = along(D.upperArm + D.foreArm + D.wristFingers, 0.016);
  }
  return p;
}

// Solved through packages/core/src/contact.ts, capsules thickened by a gi (see docs/gi-plan.html):
// standing (GrappleMap line 564), distance closed guard (1592), seated back w/ seatbelt (1659);
// and a frame of "escape roll" (7183) from graph.json, seated with a rounded back.
const CODES = {
  escape: "s5aASko8aAL2vWaDPPsPaELwvybgQ2rVaUMEv6hSPctjgRJtAFc8MSxybGLsCBiGJtAgieFdAVfKMIBLeZChxDh8NPzlbtDkwpisN9ydbxDXvshLNCxjaFDIAhdhIwAMjCHBzylNIrKZjZUOLbjFMyIcmnUEIUmvNbIgkYUZIIk5NaDlgxWXDtgSOHxujoUvxkjkQOAJbFU7z5bxPLyGehYqw8d0M1Boa5YWAEfrKRAWbqZ7BTfCKrBgaB07CBeuKpwJfsSKAYb8SmDnbWTp",
  standing: "KhaCPET1aKFnNJaSOrXfaGHeMIbVOKV5bBHaMbiTOHRzgSGXQ0nrMyRrnzISOrv8NKNDvWInLZthQzKysyJrH8uQRiHgvaKrHvvER8GjvWKGGgvVR3FavFK7QurnKQNFwSK5LByzLwDoaAKvuIaAU9zKaFK2ryaNTiAMbGK7sAbLTyBTiwLzwChoTJxKnDNPvEnGQUzlwtMYyOwxShASsEKNCdtkSdEnuVJZF3u1ReE2v4JWGPvTQKGlv3JPH5vEQwwSrCPtzwxjPEBAyZPj",
  guard: "y9aAzEwGaAEUCactAOzmcPF1BNa8AwyMbBGAICbrBlDRbqLjClecCrANd3FNIOiYEoGwiZJsJvelD5F8esKFLqdYHQKpebJJLSeNIILreJKbMKetJDMmefKSCYhLESHTjwG2JKlhHVwUgTzjuXi2BozBe3A5w9gxCUyCf2BtxwhNCaAthaH4EthbBxGfdfIqHZcpFeNRcGNwQjcvIFJQa8PfPka9EhHibML0LfbaFLHec7L1LzcmFpHJdKK3KKdjFrKobTIMPMcSLsRreMMc",
  back: "IFdhv4I0fYxLJmcHzDKodvz7IXdUyRKbeVz9HjgnFaQqgmCHKWbTIZOobOHyLYkcLAQBjkINHVjvJiQnfnGjKyiQFSNnhYENLJiwFzMJiZEnL4hWEvLpi0EqNQewKSOKknKDObl3ICFbaAsiMmaAqRFYaDvWMiaCuBFrbvuZLZbttxDOfQz5NDg9w6IQbGCtMqbGBeJXhnJtNWjnGPGhhOGDRpg2ETKbilEPNOiwDjKGjqFkNdjDDGLVjHFeMujCEILEehEDLHjeIqKwlAH8",
};
const POSES = {
  t: { label: "T-pose", players: () => [tPose()] },
  standing: { label: "standing (GrappleMap 564, one fighter)", players: () => grapple(CODES.standing, [0]) },
  guard: { label: "distance closed guard (1592)", players: () => grapple(CODES.guard, [0, 1]) },
  back: { label: "seated back w/ seatbelt (1659)", players: () => grapple(CODES.back, [0, 1]) },
  escape: { label: "escape roll, from omoplata (7183)", players: () => grapple(CODES.escape, [0, 1]) },
};
/** GrappleMap players, moved so they stand around the origin. */
function grapple(code, which) {
  const all = which.map((k) => decodePose(code)[k]);
  const c = [0, 2].map((i) => all.reduce((s, p) => s + (p.LeftHip[i] + p.RightHip[i]) / 2, 0) / all.length);
  return all.map((p) => Object.fromEntries(Object.entries(p).map(([j, x]) => [j, [x[0] - c[0], x[1], x[2] - c[1]]])));
}

const BONES = [
  ["Head", "Neck"], ["Neck", "Core"], ["LeftShoulder", "RightShoulder"], ["LeftHip", "RightHip"],
  ...["Left", "Right"].flatMap((s) => [
    ["Neck", s + "Shoulder"], [s + "Shoulder", s + "Elbow"], [s + "Elbow", s + "Wrist"], [s + "Wrist", s + "Hand"], [s + "Hand", s + "Fingers"],
    ["Core", s + "Hip"], [s + "Hip", s + "Knee"], [s + "Knee", s + "Ankle"], [s + "Ankle", s + "Heel"], [s + "Ankle", s + "Toe"], [s + "Heel", s + "Toe"],
  ]),
];
const FIGHTER = ["#f2b544", "#5fb4ff"];
/** The reference's own wood, sampled from its renders. */
const REFERENCE_WOOD = "#ecc083";

const theme = () => (matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light") || document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const view = document.getElementById("view");
const tip = document.getElementById("tip");
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

const ref = landmarksFromPlayer(tPose());
document.getElementById("height").textContent = (ref.Head.y + 0.118 + 0.01).toFixed(2) + " m";
document.getElementById("span").textContent = (ref.LeftFingers.x - ref.RightFingers.x + 2 * 0.035).toFixed(2) + " m";
document.getElementById("dims").innerHTML = [
  ["thigh", DIMS.thigh], ["shin", DIMS.shin], ["upper arm", DIMS.upperArm], ["forearm", DIMS.foreArm],
  ["wrist → hand (palm)", DIMS.wristHand], ["wrist → fingers", DIMS.wristFingers], ["heel → toe", DIMS.heelToe], ["hips, joint to joint", DIMS.hipWidth],
  ["shoulders, joint to joint", DIMS.shoulderWidth], ["mid-hip → core", DIMS.midHipCore], ["core → neck", DIMS.coreNeck], ["neck → head", DIMS.neckHead],
].map(([k, x]) => `<tr><td>${k}</td><td class="num">${(x * 100).toFixed(1)} cm</td></tr>`).join("");

let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { document.getElementById("fallback").style.display = "grid"; }

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  view.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.02, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  // The viewer's lights (packages/three/src/viewer.ts).
  const hemi = new THREE.HemisphereLight("#dfe8f5", "#24324a", 1.4);
  const key = new THREE.DirectionalLight("#ffffff", 2.2);
  key.position.set(1.5, 4, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 10 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight("#9fb8ff", 0.6);
  fill.position.set(-2, 2, -1.5);
  scene.add(hemi, key, fill);

  const figures = [new Mannequin(), new Mannequin()];
  for (const f of figures) scene.add(f.group);
  const uniforms = sharedUniforms();
  const state = { pose: "t", look: "reference", belt: "white", place: "backdrop", build: 1, skeleton: false, spin: false };
  let players = POSES.t.players().map(landmarksFromPlayer);

  /** The reference's backdrop: a dark radial gradient, no floor; the key light comes from the camera. */
  function backdrop() {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d"), g = x.createRadialGradient(256, 230, 20, 256, 256, 380);
    g.addColorStop(0, "#34373d");
    g.addColorStop(1, "#1c1d20");
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { group: new THREE.Group(), background: tex, fog: null, hemi: 2.4, key: 1.5, light: false };
  }
  let env = null;
  function setPlace() {
    if (env) { scene.remove(env.group); env.group.traverse((o) => o.geometry?.dispose?.()); }
    env = state.place === "backdrop" ? backdrop() : buildEnvironment(state.place, theme());
    scene.add(env.group);
    scene.background = env.background;
    scene.fog = env.fog;
    hemi.intensity = env.hemi;
    key.intensity = env.key ?? 2.2;
    restyle();
  }

  // The skeleton: GrappleMap's 23 joints and the bones between them, drawn over the bodies.
  const skeleton = new THREE.Group();
  scene.add(skeleton);
  const jointMat = new THREE.MeshBasicMaterial({ color: "#ff3355", depthTest: false });
  const boneMat = new THREE.LineBasicMaterial({ color: "#ff3355", depthTest: false, transparent: true, opacity: 0.8 });
  let pickables = [];
  function drawSkeleton() {
    skeleton.traverse((o) => o.geometry?.dispose?.());
    skeleton.clear();
    pickables = [];
    for (const p of players) {
      for (const j of JOINTS) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), jointMat);
        m.position.copy(p[j]);
        m.renderOrder = 2;
        m.userData.label = j;
        skeleton.add(m);
        pickables.push(m);
      }
      const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(BONES.flatMap(([a, b]) => [p[a], p[b]])), boneMat);
      lines.renderOrder = 1;
      skeleton.add(lines);
    }
    skeleton.visible = state.skeleton;
  }

  function restyle() {
    figures.forEach((f, k) => {
      f.group.visible = !!players[k];
      if (!players[k]) return;
      f.build = state.build;
      if (state.look === "reference") {
        const wood = new THREE.MeshStandardMaterial({ color: REFERENCE_WOOD, roughness: 0.58 });
        f.paint({ body: wood, joint: new THREE.MeshStandardMaterial({ color: new THREE.Color(REFERENCE_WOOD).multiplyScalar(0.9), roughness: 0.6 }), belt: new THREE.MeshStandardMaterial({ color: "#f2f0ea", roughness: 0.85 }) });
      } else f.paint(paint(state.look, FIGHTER[k], uniforms, state.belt, !!env?.light));
      f.pose(players[k]);
    });
    drawSkeleton();
    const deg = (r) => Math.round((r * 180) / Math.PI) + "°";
    document.getElementById("folds").innerHTML = ["Left", "Right"].map((s) => {
      const h = figures[0].hands[s];
      return h ? `<tr><td>${s.toLowerCase()} hand</td><td class="num">fingers ${deg(h.fingers)} · thumb ${deg(h.thumb)}</td></tr>` : "";
    }).join("");
  }

  function resize() {
    const w = view.clientWidth, h = view.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(view);
  resize();

  function frame(name) {
    if (name === "hand") {
      // The first fighter's right hand: from the back of the hand, the thumb's side, a little above.
      const h = figures[0].hands.Right;
      controls.target.copy(h.palm);
      camera.position.copy(h.palm).addScaledVector(h.palmNormal, -0.34).addScaledVector(h.thumbSide, 0.24).add(V3(0, 0.1, 0));
      controls.update();
      return;
    }
    const ground = players.length > 1;
    const ty = state.pose === "t" || state.pose === "standing" ? 0.95 : 0.4;
    // Far enough for the arm span across the view's width, whatever its shape.
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const d = Math.max(ground ? 2.6 : 3.9, (ground ? 1.9 : 2.0) / 2 / Math.tan(hfov / 2));
    controls.target.set(0, ty, 0);
    // As the reference views: a little from above; the top view turned as the reference's.
    if (name === "top") camera.position.set(0.001, ty + d * 1.05, 0);
    else {
      const dir = { front: [0, 0.2, 1], side: [1, 0.2, 0], back: [0, 0.2, -1], three: [0.5, 0.5, 0.75] }[name];
      camera.position.set(dir[0] * d, ty + dir[1] * d, dir[2] * d);
    }
    controls.update();
  }

  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
    frame(b.dataset.view);
    document.querySelectorAll("figure[data-view]").forEach((f) => f.classList.toggle("on", f.dataset.view === b.dataset.view));
    if (b.tagName === "FIGURE") view.scrollIntoView({ behavior: "smooth", block: "center" });
  }));
  const bind = (id, key, parse = (x) => x) => document.getElementById(id).addEventListener("input", (e) => { state[key] = parse(e.target.type === "checkbox" ? e.target.checked : e.target.value); apply(key); });
  function apply(key) {
    if (key === "place") setPlace();
    else if (key === "skeleton") skeleton.visible = state.skeleton;
    else if (key === "spin") controls.autoRotate = state.spin;
    else if (key === "pose") { players = POSES[state.pose].players().map(landmarksFromPlayer); restyle(); frame("three"); }
    else restyle();
    if (key === "build") document.getElementById("buildOut").textContent = state.build.toFixed(2);
  }
  document.getElementById("look").innerHTML = `<option value="reference">reference wood</option>` + LOOKS.map((l) => `<option>${l}</option>`).join("");
  document.getElementById("belt").innerHTML = BELTS.map((b) => `<option>${b}</option>`).join("");
  document.getElementById("pose").innerHTML = Object.entries(POSES).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("");
  bind("look", "look"); bind("belt", "belt"); bind("place", "place"); bind("build", "build", Number); bind("pose", "pose");
  bind("skel", "skeleton"); bind("spin", "spin");

  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!skeleton.visible) { tip.style.display = "none"; return; }
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(pickables)[0];
    if (!hit) { tip.style.display = "none"; return; }
    tip.textContent = hit.object.userData.label;
    tip.style.display = "block";
    tip.style.left = (e.clientX - r.left + 12) + "px";
    tip.style.top = (e.clientY - r.top + 12) + "px";
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", setPlace);
  // On the backdrop the key light follows the camera, as in the reference's renders.
  const keyHome = key.position.clone();
  controls.addEventListener("change", () => {
    if (state.place === "backdrop") key.position.copy(camera.position).add(V3(0.6, 1.2, 0));
    else key.position.copy(keyHome);
  });

  window.__character = { camera, controls, figures, frame, state, apply };
  setPlace();
  frame("three");
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
}
