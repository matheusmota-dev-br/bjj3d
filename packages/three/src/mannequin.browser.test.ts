import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";
import type { Landmarks } from "@bjj3d/metrics";
import { BELT_COLORS, BELTS, CORE_REACH, JOINT_BALLS, Mannequin, type Paint } from "./mannequin.ts";
import { positionLandmarks } from "./test/mannequin-fixtures.ts";

const SIDES = ["Left", "Right"] as const;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

let l: Landmarks;
beforeAll(async () => {
  [l] = await positionLandmarks("mount");
});

const at = (m: THREE.Object3D, local: THREE.Vector3) => { m.updateMatrixWorld(true); return m.localToWorld(local.clone()); };
const axis = (m: THREE.Object3D) => V(0, 1, 0).applyQuaternion(m.quaternion);
const close = (a: THREE.Vector3, b: THREE.Vector3, eps = 1e-6) => expect(a.distanceTo(b)).toBeLessThan(eps);
const copy = (p: Landmarks) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.clone()])) as Landmarks;
const posed = (p: Landmarks, build = 1) => { const m = new Mannequin(); m.build = build; m.pose(p); return m; };

describe("Mannequin", () => {
  test("is 56 rigid pieces, all casting and receiving shadows, each with its name", () => {
    const m = new Mannequin();
    expect(m.group.children).toHaveLength(56);
    expect(Object.keys(m.pieces)).toHaveLength(56);
    for (const c of m.group.children) {
      expect((c as THREE.Mesh).isMesh).toBe(true);
      expect(c.castShadow && c.receiveShadow).toBe(true);
      expect(m.pieces[c.name]).toBe(c);
    }
  });

  test("the shadows switch turns both on and off on every piece", () => {
    const m = new Mannequin();
    m.shadows = false;
    expect(m.group.children.every((c) => !c.castShadow && !c.receiveShadow)).toBe(true);
    m.shadows = true;
    expect(m.group.children.every((c) => c.castShadow && c.receiveShadow)).toBe(true);
  });

  test("paint puts the wood on the pieces, the joint material on balls and seams, the belt on the belt", () => {
    const m = new Mannequin();
    const p: Paint = { body: new THREE.MeshBasicMaterial(), joint: new THREE.MeshBasicMaterial(), belt: new THREE.MeshBasicMaterial() };
    m.paint(p);
    const count = (mat: THREE.Material) => m.group.children.filter((c) => (c as THREE.Mesh).material === mat).length;
    expect(count(p.body)).toBe(29);
    expect(count(p.joint)).toBe(25);
    expect(count(p.belt)).toBe(2);
    for (const name of ["LeftKneeBall", "Waist", "RightKnuckles", "NeckSeam"]) expect(m.pieces[name].material).toBe(p.joint);
    for (const name of ["belt", "knot"]) expect(m.pieces[name].material).toBe(p.belt);
    expect(m.pieces.head.material).toBe(p.body);
  });

  test("every limb runs exactly from its joint to the next", () => {
    const m = posed(l);
    for (const s of SIDES) {
      for (const [piece, a, b] of [["UpperArm", "Shoulder", "Elbow"], ["ForeArm", "Elbow", "Wrist"], ["Thigh", "Hip", "Knee"], ["Shin", "Knee", "Ankle"], ["Palm", "Wrist", "Hand"]]) {
        const limb = m.pieces[s + piece], from = l[(s + a) as keyof Landmarks], to = l[(s + b) as keyof Landmarks];
        close(limb.position, from);
        close(at(limb, V(0, 1, 0)), to, 1e-5);
      }
    }
  });

  test("a ball fills every joint, sized by its radius and the build", () => {
    const m = posed(l, 1.25);
    for (const s of SIDES) for (const [j, r] of Object.entries(JOINT_BALLS)) {
      const b = m.pieces[`${s}${j}Ball`];
      close(b.position, l[(s + j) as keyof Landmarks]);
      expect(b.scale.x).toBeCloseTo(r * 1.25, 9);
    }
    // A bent knee keeps its ball inside both ends' reach: never a gap between thigh and shin.
    const thighEnd = at(m.pieces.LeftThigh, V(0, 0.93, 0)), shinStart = at(m.pieces.LeftShin, V(0, 0.07, 0));
    expect(thighEnd.distanceTo(l.LeftKnee)).toBeLessThan(m.pieces.LeftKneeBall.scale.x);
    expect(shinStart.distanceTo(l.LeftKnee)).toBeLessThan(m.pieces.LeftKneeBall.scale.x);
  });

  test("the build thickens the pieces but keeps their length", () => {
    const thin = posed(l), thick = posed(l, 1.4);
    expect(thick.pieces.LeftThigh.scale.x).toBeCloseTo(1.4, 9);
    expect(thin.pieces.LeftThigh.scale.x).toBeCloseTo(1, 9);
    expect(thick.pieces.LeftThigh.scale.y).toBeCloseTo(thin.pieces.LeftThigh.scale.y, 9);
    expect(thick.pieces.chest.scale.z).toBeCloseTo(1.4, 9);
    expect(thick.pieces.chest.scale.y).toBeCloseTo(thin.pieces.chest.scale.y, 9);
  });

  test("the waist is straight when the back is, and splits a bend between pelvis and abdomen", () => {
    // GrappleMap's Core behind the line from mid-hip to neck: the raw bones would meet at an angle.
    const raw = V().subVectors(l.Core, l.MidHip).normalize().angleTo(V().subVectors(l.Neck, l.Core).normalize());
    const m = posed(l);
    const bend = axis(m.pieces.pelvis).angleTo(axis(m.pieces.abdomen));
    expect(bend).toBeLessThan(raw * 0.55);
    // Core put on that line: the pelvis and the abdomen line up exactly.
    const straight = copy(l);
    straight.Core = l.MidHip.clone().lerp(l.Neck, 0.4);
    const s = posed(straight);
    expect(axis(s.pieces.pelvis).angleTo(axis(s.pieces.abdomen))).toBeLessThan(1e-6);
    expect(axis(s.pieces.chest).angleTo(axis(s.pieces.abdomen))).toBeLessThan(1e-6);
  });

  test("a rounded back keeps the abdomen and the chest on the pelvis", () => {
    // Core 15 cm behind the line from mid-hip to neck, as seated slumped (GrappleMap's "escape roll").
    const spine = V().subVectors(l.Neck, l.MidHip).normalize();
    const back = V().crossVectors(V().subVectors(l.LeftShoulder, l.RightShoulder), spine).normalize().negate();
    const slumped = copy(l);
    slumped.Core = l.MidHip.clone().lerp(l.Neck, 0.38).addScaledVector(back, 0.15);
    const m = posed(slumped);
    const offLine = (p: THREE.Vector3) => { const d = V().subVectors(p, l.MidHip); return d.addScaledVector(spine, -d.dot(spine)).length(); };
    expect(offLine(m.pieces.abdomen.position)).toBeCloseTo(CORE_REACH, 9);
    expect(offLine(m.pieces.chest.position)).toBeCloseTo(CORE_REACH, 9);
    // Within reach, Core is used as it is.
    const near = copy(l);
    near.Core = l.MidHip.clone().lerp(l.Neck, 0.38).addScaledVector(back, 0.02);
    close(posed(near).pieces.abdomen.position, near.Core);
  });

  test("the waist filler sits between the pelvis's top and the abdomen's bottom", () => {
    const m = posed(l);
    const top = at(m.pieces.pelvis, V(0, 0.72, 0)), bottom = at(m.pieces.abdomen, V(0, -0.25, 0));
    close(m.pieces.Waist.position, top.clone().add(bottom).multiplyScalar(0.5), 1e-5);
    expect(m.pieces.Waist.scale.y).toBeGreaterThanOrEqual(0.04);
  });

  test("the belt circles the pelvis where the studio looks, its knot in front", () => {
    const m = posed(l);
    const belt = m.pieces.belt.position, knot = m.pieces.knot.position;
    expect(belt.distanceTo(l.MidHip.clone().lerp(l.Core, 0.3))).toBeLessThan(0.03);
    const forward = V().crossVectors(V().subVectors(l.LeftShoulder, l.RightShoulder), V().subVectors(l.Neck, l.Core)).normalize();
    expect(V().subVectors(knot, belt).normalize().dot(forward)).toBeGreaterThan(0.8);
  });

  test("the head sits over the neck, its widest section 2.7 cm past the Head joint", () => {
    const m = posed(l);
    const headDir = V().subVectors(l.Head, l.Neck).normalize();
    close(m.pieces.head.position, l.Head.clone().addScaledVector(headDir, 0.027));
    close(m.pieces.neck.position, l.Neck);
    close(at(m.pieces.neck, V(0, 1, 0)), l.Head, 1e-5);
  });

  test("the fingers fold at Hand by GrappleMap's angle, and the thumb follows", () => {
    const m = posed(l);
    for (const s of SIDES) {
      const w = l[`${s}Wrist`], h = l[`${s}Hand`], f = l[`${s}Fingers`];
      const fold = V().subVectors(h, w).normalize().angleTo(V().subVectors(f, h).normalize());
      const hand = m.hands[s]!;
      expect(hand.fingers).toBeCloseTo(fold, 9);
      expect(hand.thumb).toBeCloseTo(Math.min(1.35, 0.15 + fold * 0.9), 9);
      for (let i = 0; i < 4; i++) {
        const finger = m.pieces[`${s}Finger${i}`];
        expect(finger.position.distanceTo(h)).toBeLessThan(0.04);
        expect(axis(finger).dot(V().subVectors(f, h).normalize())).toBeCloseTo(1, 6);
      }
      close(m.pieces[s + "Knuckles"].position, h);
      // The thumb is on the other side of the hand from the little finger.
      expect(V().subVectors(m.pieces[s + "ThumbBase"].position, w).dot(hand.thumbSide)).toBeGreaterThan(0);
      expect(V().subVectors(m.pieces[`${s}Finger3`].position, h).dot(hand.thumbSide)).toBeLessThan(0);
    }
  });

  test("a hand closed past 80 degrees keeps the thumb's fold at its limit", () => {
    const closed = copy(l);
    const w = l.LeftWrist, h = l.LeftHand, d1 = V().subVectors(h, w).normalize();
    const side = V().crossVectors(d1, V(0, 1, 0)).normalize(), back = V().crossVectors(side, d1).normalize();
    closed.LeftFingers = h.clone().addScaledVector(d1, -0.03).addScaledVector(back, 0.05);
    const m = posed(closed);
    expect(m.hands.Left!.fingers).toBeGreaterThan(1.4);
    expect(m.hands.Left!.thumb).toBe(1.35);
  });

  test("a straight hand faces down from the torso; one along the spine faces forward", () => {
    const up = V().subVectors(l.Neck, l.Core).normalize();
    const flat = copy(l), w = l.LeftWrist, d1 = V().subVectors(l.LeftHand, w).normalize();
    flat.LeftFingers = w.clone().addScaledVector(d1, 0.14);
    const m = posed(flat);
    const down = up.clone().negate().addScaledVector(d1, up.dot(d1)).normalize();
    expect(m.hands.Left!.palmNormal.dot(down)).toBeCloseTo(1, 6);
    expect(m.hands.Left!.fingers).toBeLessThan(1e-3);

    const raised = copy(l);
    raised.LeftHand = w.clone().addScaledVector(up, 0.081);
    raised.LeftFingers = w.clone().addScaledVector(up, 0.14);
    const r = posed(raised);
    const forward = V().crossVectors(V().subVectors(l.LeftShoulder, l.RightShoulder), V().subVectors(l.Neck, l.Core)).normalize();
    expect(r.hands.Left!.palmNormal.dot(forward)).toBeCloseTo(1, 6);
  });

  test("feet run from the heel along the toe, stretched to the foot's length", () => {
    const m = posed(l);
    for (const s of SIDES) {
      const heel = l[`${s}Heel`], toe = l[`${s}Toe`], foot = m.pieces[s + "Foot"];
      close(foot.position, heel);
      expect(foot.scale.y).toBeCloseTo(heel.distanceTo(toe) / 0.23, 9);
      expect(axis(foot).dot(V().subVectors(toe, heel).normalize())).toBeCloseTo(1, 6);
    }
  });

  test("every piece of both fighters of every sampled position is finite", async () => {
    for (const name of ["mount", "staredown", "half guard shell", "north south"]) {
      for (const pl of await positionLandmarks(name)) {
        const m = posed(pl);
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
