// A jointed mannequin: one rigid, rounded piece between each pair of GrappleMap joints, a
// ball at each joint, blocks for the torso, a plain head, simple hands and feet, and a belt.
//
// Nothing deforms: every piece is placed straight from the joints, every frame, so the
// figure is exactly the data. The pieces are as thick as the contact solver's capsules
// (data/body/capsules.json), so what the solver keeps apart is what you see kept apart.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Joint } from "./grapplemap.ts";
import type { Landmarks } from "./landmarks.ts";

export const BELTS = ["white", "blue", "purple", "brown", "black"] as const;
export type Belt = (typeof BELTS)[number];
export const BELT_COLORS: Record<Belt, string> = { white: "#f2f0ea", blue: "#2457b8", purple: "#6a3a9c", brown: "#6b4226", black: "#1a1a1c" };

/** What a mannequin's materials are: body pieces, joint balls, belt. */
export interface Paint { body: THREE.Material; joint: THREE.Material; belt: THREE.Material }

type Side = "Left" | "Right";
const SIDES: Side[] = ["Left", "Right"];
const v = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** A tapered limb piece from y = 0 (radius r0) to y = 1 (radius r1). */
function limb(r0: number, r1: number) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, 20, 1, true);
  g.translate(0, 0.5, 0);
  return g;
}

// Radii in metres, near the contact solver's capsules (a little slimmer at the far end).
const LIMBS: { a: string; b: string; geo: THREE.BufferGeometry }[] = SIDES.flatMap((s) => [
  { a: `${s}Shoulder`, b: `${s}Elbow`, geo: limb(0.048, 0.04) },
  { a: `${s}Elbow`, b: `${s}Wrist`, geo: limb(0.038, 0.028) },
  { a: `${s}Hip`, b: `${s}Knee`, geo: limb(0.074, 0.052) },
  { a: `${s}Knee`, b: `${s}Ankle`, geo: limb(0.05, 0.035) },
]);
const JOINT_BALLS: [string, number][] = SIDES.flatMap((s): [string, number][] => [
  [`${s}Shoulder`, 0.054], [`${s}Elbow`, 0.042], [`${s}Wrist`, 0.031], [`${s}Hip`, 0.07], [`${s}Knee`, 0.054], [`${s}Ankle`, 0.037],
]);
const BALL = new THREE.SphereGeometry(1, 24, 16);
const BOX = new RoundedBoxGeometry(1, 1, 1, 4, 0.3);
const NECK = limb(0.05, 0.045);
const HEAD = new THREE.SphereGeometry(1, 32, 24);
const BELT = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true);

/** An orthonormal frame: y along `along`, x as close to `across` as it can be. */
function basis(along: THREE.Vector3, across: THREE.Vector3) {
  const y = along.clone().normalize();
  const x = across.clone().addScaledVector(y, -across.dot(y));
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0).addScaledVector(y, -y.x);
  x.normalize();
  const z = v().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

export class Mannequin {
  readonly group = new THREE.Group();
  private limbs: THREE.Mesh[] = [];
  private balls: THREE.Mesh[] = [];
  private chest: THREE.Mesh;
  private belly: THREE.Mesh;
  private pelvis: THREE.Mesh;
  private neck: THREE.Mesh;
  private head: THREE.Mesh;
  private nose: THREE.Mesh;
  private hands: THREE.Mesh[] = [];
  private feet: THREE.Mesh[] = [];
  private belt: THREE.Mesh;
  private knot: THREE.Mesh;
  /** Thickness, 1 for the standard body. */
  build = 1;

  constructor() {
    const mesh = (g: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(g);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    this.limbs = LIMBS.map((l) => mesh(l.geo));
    this.balls = JOINT_BALLS.map(() => mesh(BALL));
    this.chest = mesh(BOX);
    this.belly = mesh(BOX);
    this.pelvis = mesh(BOX);
    this.neck = mesh(NECK);
    this.head = mesh(HEAD);
    this.nose = mesh(BALL);
    this.hands = SIDES.map(() => mesh(BOX));
    this.feet = SIDES.map(() => mesh(BOX));
    this.belt = mesh(BELT);
    this.knot = mesh(BOX);
  }

  paint(p: Paint) {
    for (const m of [...this.limbs, this.chest, this.belly, this.pelvis, this.neck, this.head, this.nose, ...this.hands, ...this.feet]) m.material = p.body;
    for (const m of this.balls) m.material = p.joint;
    this.belt.material = this.knot.material = p.belt;
  }

  set shadows(on: boolean) {
    this.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = on; });
  }

  /** Places every piece from this frame's joints. */
  pose(l: Landmarks) {
    const k = this.build;
    const P = (j: string) => l[j as Joint];

    LIMBS.forEach((spec, i) => {
      const a = P(spec.a), b = P(spec.b), m = this.limbs[i];
      const d = v().subVectors(b, a);
      m.position.copy(a);
      m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
      m.scale.set(k, d.length(), k);
    });
    JOINT_BALLS.forEach(([j, r], i) => {
      this.balls[i].position.copy(P(j));
      this.balls[i].scale.setScalar(r * k);
    });

    // Torso: three rounded blocks along the spine, turned by the shoulders and the hips.
    const lat = v().subVectors(l.RightShoulder, l.LeftShoulder);
    const hipLat = v().subVectors(l.RightHip, l.LeftHip);
    const up = v().subVectors(l.Neck, l.Core);
    const low = v().subVectors(l.Core, l.MidHip);
    const block = (m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, across: THREE.Vector3, width: number, depth: number, extra = 0) => {
      const d = v().subVectors(to, from);
      m.position.copy(from).add(to).multiplyScalar(0.5);
      m.quaternion.copy(basis(d, across));
      m.scale.set(width * k, d.length() + extra, depth * k);
    };
    // Chest from the base of the ribs to the shoulders, a narrower waist, then the hips.
    const shoulderWidth = lat.length() + 0.05;
    const ribs = l.Core.clone().lerp(l.Neck, 0.15);
    block(this.chest, ribs, l.Neck, lat, shoulderWidth, 0.19, 0.03);
    block(this.belly, l.MidHip.clone().lerp(l.Core, 0.25), ribs, lat.clone().lerp(hipLat, 0.5), hipLat.length() + 0.04, 0.16);
    const pelvisTop = l.MidHip.clone().addScaledVector(low.clone().normalize(), 0.06);
    const pelvisBottom = l.MidHip.clone().addScaledVector(low.clone().normalize(), -0.08);
    block(this.pelvis, pelvisBottom, pelvisTop, hipLat, hipLat.length() + 0.1, 0.17);

    // Belt: a band around the waist, a knot in front.
    const facing = v().crossVectors(up.clone().lerp(low, 0.5), hipLat).normalize();
    const waist = l.MidHip.clone().lerp(l.Core, 0.3);
    this.belt.position.copy(waist);
    this.belt.quaternion.copy(basis(low, hipLat));
    this.belt.scale.set(((hipLat.length() + 0.06) / 2 + 0.01) * k, 0.05, (0.17 / 2 + 0.01) * k);
    this.knot.position.copy(waist).addScaledVector(facing, (0.17 / 2 + 0.018) * k);
    this.knot.quaternion.copy(basis(low, hipLat));
    this.knot.scale.set(0.06, 0.055, 0.03);

    // Neck and head; the nose shows which way the head faces.
    const headDir = v().subVectors(l.Head, l.Neck);
    const headR = 0.095;
    const neckTop = l.Head.clone().addScaledVector(headDir.clone().normalize(), -headR * 0.8);
    const nd = v().subVectors(neckTop, l.Neck);
    this.neck.position.copy(l.Neck);
    this.neck.quaternion.setFromUnitVectors(UP, nd.clone().normalize());
    this.neck.scale.set(k, Math.max(nd.length(), 0.01), k);
    const headFace = v().crossVectors(headDir, lat).normalize();
    this.head.position.copy(l.Head);
    this.head.quaternion.copy(basis(headDir, lat));
    this.head.scale.set(headR * 0.86, headR * 1.08, headR * 0.98);
    this.nose.position.copy(l.Head).addScaledVector(headFace, headR * 0.95).addScaledVector(headDir.clone().normalize(), -0.015);
    this.nose.scale.setScalar(0.018);

    // Hands: flat paddles from the wrist to the fingertips. Feet: blocks from heel to toe.
    SIDES.forEach((s, i) => {
      const w = P(`${s}Wrist`), f = P(`${s}Fingers`);
      const d = v().subVectors(f, w);
      const fore = v().subVectors(w, P(`${s}Elbow`));
      // Palm across the plane of forearm and hand; the torso's side line if they are in line.
      const across = v().crossVectors(fore, d);
      const hand = this.hands[i];
      hand.position.copy(w).addScaledVector(d, 0.55);
      hand.quaternion.copy(basis(d, across.lengthSq() > 1e-6 ? v().crossVectors(across, d) : lat));
      hand.scale.set(0.085, d.length() + 0.03, 0.032);

      const heel = P(`${s}Heel`), toe = P(`${s}Toe`), ankle = P(`${s}Ankle`);
      const fd = v().subVectors(toe, heel);
      const mid = heel.clone().add(toe).multiplyScalar(0.5);
      const footUp = v().subVectors(ankle, mid);
      const foot = this.feet[i];
      foot.position.copy(mid).addScaledVector(footUp.clone().normalize(), 0.015);
      foot.quaternion.copy(basis(fd, v().crossVectors(footUp, fd)));
      foot.scale.set(0.085 * k, fd.length() + 0.05, 0.065 * k);
    });
  }
}
