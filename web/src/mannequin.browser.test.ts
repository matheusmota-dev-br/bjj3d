import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";
import type { Landmarks } from "./landmarks.ts";
import { BELT_COLORS, BELTS, Mannequin, type Paint } from "./mannequin.ts";
import { positionLandmarks } from "./test/mannequin-fixtures.ts";

// The order the pieces are added to the group (see the constructor).
const LIMBS: [string, string][] = ["Left", "Right"].flatMap((s) => [
  [`${s}Shoulder`, `${s}Elbow`], [`${s}Elbow`, `${s}Wrist`], [`${s}Hip`, `${s}Knee`], [`${s}Knee`, `${s}Ankle`],
] as [string, string][]);
const BALLS: [string, number][] = ["Left", "Right"].flatMap((s) => [
  [`${s}Shoulder`, 0.054], [`${s}Elbow`, 0.042], [`${s}Wrist`, 0.031], [`${s}Hip`, 0.07], [`${s}Knee`, 0.054], [`${s}Ankle`, 0.037],
] as [string, number][]);
const piece = {
  limb: (i: number) => i,
  ball: (i: number) => 8 + i,
  chest: 20, belly: 21, pelvis: 22, neck: 23, head: 24, nose: 25,
  hand: (i: number) => 26 + i,
  foot: (i: number) => 28 + i,
  belt: 30, knot: 31,
};

let l: Landmarks;
beforeAll(async () => {
  [l] = await positionLandmarks("mount");
});

const at = (m: THREE.Object3D, local: THREE.Vector3) => { m.updateMatrixWorld(true); return m.localToWorld(local.clone()); };
const mesh = (m: Mannequin, i: number) => m.group.children[i] as THREE.Mesh;
const close = (a: THREE.Vector3, b: THREE.Vector3, eps = 1e-6) => expect(a.distanceTo(b)).toBeLessThan(eps);

describe("Mannequin", () => {
  test("is 32 rigid pieces, all casting and receiving shadows", () => {
    const m = new Mannequin();
    expect(m.group.children).toHaveLength(32);
    for (const c of m.group.children) {
      expect((c as THREE.Mesh).isMesh).toBe(true);
      expect(c.castShadow && c.receiveShadow).toBe(true);
    }
  });

  test("the shadows switch turns both on and off on every piece", () => {
    const m = new Mannequin();
    m.shadows = false;
    expect(m.group.children.every((c) => !c.castShadow && !c.receiveShadow)).toBe(true);
    m.shadows = true;
    expect(m.group.children.every((c) => c.castShadow && c.receiveShadow)).toBe(true);
  });

  test("paint puts the body, joint and belt materials on their pieces", () => {
    const m = new Mannequin();
    const p: Paint = { body: new THREE.MeshBasicMaterial(), joint: new THREE.MeshBasicMaterial(), belt: new THREE.MeshBasicMaterial() };
    m.paint(p);
    const count = (mat: THREE.Material) => m.group.children.filter((c) => (c as THREE.Mesh).material === mat).length;
    expect(count(p.body)).toBe(18);
    expect(count(p.joint)).toBe(12);
    expect(count(p.belt)).toBe(2);
    for (let i = 0; i < 12; i++) expect(mesh(m, piece.ball(i)).material).toBe(p.joint);
    expect(mesh(m, piece.belt).material).toBe(p.belt);
    expect(mesh(m, piece.knot).material).toBe(p.belt);
  });

  test("every limb runs exactly from its joint to the next", () => {
    const m = new Mannequin();
    m.pose(l);
    LIMBS.forEach(([a, b], i) => {
      const limb = mesh(m, piece.limb(i));
      close(limb.position, l[a as keyof Landmarks]);
      close(at(limb, new THREE.Vector3(0, 1, 0)), l[b as keyof Landmarks], 1e-5);
    });
  });

  test("a ball sits on every joint, sized by its radius and the build", () => {
    const m = new Mannequin();
    m.build = 1.25;
    m.pose(l);
    BALLS.forEach(([j, r], i) => {
      const ball = mesh(m, piece.ball(i));
      close(ball.position, l[j as keyof Landmarks]);
      expect(ball.scale.x).toBeCloseTo(r * 1.25, 9);
    });
  });

  test("the build thickens limbs and torso but keeps their length", () => {
    const thin = new Mannequin(), thick = new Mannequin();
    thick.build = 1.4;
    thin.pose(l);
    thick.pose(l);
    const limb0 = (m: Mannequin) => mesh(m, piece.limb(0)).scale;
    expect(limb0(thick).x).toBeCloseTo(1.4, 9);
    expect(limb0(thin).x).toBeCloseTo(1, 9);
    expect(limb0(thick).y).toBeCloseTo(limb0(thin).y, 9);
    expect(mesh(thick, piece.chest).scale.x).toBeCloseTo(mesh(thin, piece.chest).scale.x * 1.4, 9);
    expect(mesh(thick, piece.chest).scale.y).toBeCloseTo(mesh(thin, piece.chest).scale.y, 9);
  });

  test("the torso blocks stack from the hips to the neck, the chest a little past it", () => {
    const m = new Mannequin();
    m.pose(l);
    const ribs = l.Core.clone().lerp(l.Neck, 0.15);
    close(mesh(m, piece.chest).position, ribs.clone().add(l.Neck).multiplyScalar(0.5));
    expect(mesh(m, piece.chest).scale.y).toBeCloseTo(ribs.distanceTo(l.Neck) + 0.03, 9);
    const bellyFrom = l.MidHip.clone().lerp(l.Core, 0.25);
    close(mesh(m, piece.belly).position, bellyFrom.add(ribs).multiplyScalar(0.5));
    // The pelvis straddles the point between the hips, 6 cm up and 8 cm down the spine.
    expect(mesh(m, piece.pelvis).scale.y).toBeCloseTo(0.14, 9);
    expect(mesh(m, piece.pelvis).position.distanceTo(l.MidHip)).toBeCloseTo(0.01, 9);
  });

  test("the belt circles the waist with the knot in front", () => {
    const m = new Mannequin();
    m.pose(l);
    const waist = l.MidHip.clone().lerp(l.Core, 0.3);
    close(mesh(m, piece.belt).position, waist);
    const knot = mesh(m, piece.knot).position;
    expect(knot.distanceTo(waist)).toBeCloseTo(0.17 / 2 + 0.018, 9);
    // In front: on the side the chest faces, away from the back.
    const facing = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(l.Neck, l.Core).lerp(new THREE.Vector3().subVectors(l.Core, l.MidHip), 0.5),
      new THREE.Vector3().subVectors(l.RightHip, l.LeftHip)).normalize();
    expect(new THREE.Vector3().subVectors(knot, waist).normalize().dot(facing)).toBeCloseTo(1, 9);
  });

  test("the neck reaches the head, which faces forward with its nose", () => {
    const m = new Mannequin();
    m.pose(l);
    const neck = mesh(m, piece.neck), head = mesh(m, piece.head), nose = mesh(m, piece.nose);
    close(neck.position, l.Neck);
    close(head.position, l.Head);
    const headDir = new THREE.Vector3().subVectors(l.Head, l.Neck).normalize();
    // The neck stops inside the head, 0.8 of its radius short of the centre.
    close(at(neck, new THREE.Vector3(0, 1, 0)), l.Head.clone().addScaledVector(headDir, -0.095 * 0.8), 1e-5);
    expect(nose.position.distanceTo(l.Head)).toBeGreaterThan(0.08);
    expect(nose.scale.x).toBe(0.018);
  });

  test("a neck squashed to nothing keeps a minimum length", () => {
    const m = new Mannequin();
    const short = { ...l, Head: l.Neck.clone().add(new THREE.Vector3(0, 0.095 * 0.8, 0)) };
    m.pose(short);
    expect(mesh(m, piece.neck).scale.y).toBe(0.01);
  });

  test("hands run from wrist to fingertips and feet from heel to toe", () => {
    const m = new Mannequin();
    m.pose(l);
    ["Left", "Right"].forEach((s, i) => {
      const w = l[`${s}Wrist` as keyof Landmarks], f = l[`${s}Fingers` as keyof Landmarks];
      const hand = mesh(m, piece.hand(i));
      close(hand.position, w.clone().lerp(f, 0.55));
      expect(hand.scale.y).toBeCloseTo(w.distanceTo(f) + 0.03, 9);
      // The hand's long axis is the wrist → fingers direction.
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(hand.quaternion);
      expect(axis.dot(f.clone().sub(w).normalize())).toBeCloseTo(1, 6);

      const heel = l[`${s}Heel` as keyof Landmarks], toe = l[`${s}Toe` as keyof Landmarks];
      const foot = mesh(m, piece.foot(i));
      expect(foot.scale.y).toBeCloseTo(heel.distanceTo(toe) + 0.05, 9);
      expect(foot.position.distanceTo(heel.clone().add(toe).multiplyScalar(0.5))).toBeCloseTo(0.015, 9);
    });
  });

  test("a hand in line with its forearm and the shoulders still gets a valid orientation", () => {
    const m = new Mannequin();
    // Elbow, wrist and fingers along the shoulder line: no plane of forearm and hand, and the
    // fallback (the shoulder line) is parallel to the hand too.
    const across = new THREE.Vector3().subVectors(l.RightShoulder, l.LeftShoulder).normalize();
    const w = l.LeftWrist.clone();
    const odd = { ...l, LeftElbow: w.clone().addScaledVector(across, -0.25), LeftFingers: w.clone().addScaledVector(across, 0.1) };
    m.pose(odd);
    const q = mesh(m, piece.hand(0)).quaternion;
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 9);
    expect([q.x, q.y, q.z, q.w].every(Number.isFinite)).toBe(true);
    expect(new THREE.Vector3(0, 1, 0).applyQuaternion(q).dot(across)).toBeCloseTo(1, 6);
  });

  test("every piece of both fighters of every sampled position is finite", async () => {
    for (const name of ["mount", "staredown", "half guard shell", "north south"]) {
      for (const pl of await positionLandmarks(name)) {
        const m = new Mannequin();
        m.pose(pl);
        for (const c of m.group.children) {
          for (const n of [...c.position.toArray(), ...c.quaternion.toArray(), ...c.scale.toArray()]) expect(Number.isFinite(n)).toBe(true);
        }
      }
    }
  });

  test("the belt colours cover every rank", () => {
    expect(BELTS).toEqual(["white", "blue", "purple", "brown", "black"]);
    for (const b of BELTS) expect(BELT_COLORS[b]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
