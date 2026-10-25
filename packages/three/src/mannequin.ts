// A wooden figure, as an artist's mannequin: an egg head, a short neck with a collar seam, a
// boxy chest with shoulders, a barrel abdomen, a brief-shaped pelvis, deltoid upper arms,
// tapered forearms, thighs and shins, shoe-like feet, and a belt. The pieces' shapes were
// measured from five views of a reference figure (docs/character.html shows them); their
// lengths are GrappleMap's, so each profile is laid along its own bone: widths and depths in
// metres, positions along the bone as fractions of it (u: 0 at the first joint, 1 at the next).
//
// Nothing deforms: every piece is placed straight from the joints, every frame, so the figure
// is exactly the data. A ball fills every joint, a little smaller than the ends it joins, so a
// bent joint closes instead of opening a gap. The hand has two digits: four fingers moving
// together, folding at Hand by the angle GrappleMap stores, and a thumb with one fold, which
// GrappleMap does not have and follows the fingers for now.

import * as THREE from "three";
import type { Joint } from "@bjj3d/core";
import type { Landmarks } from "@bjj3d/metrics";
import { basis, domes, loft, piece, track } from "./loft.ts";

export const BELTS = ["white", "blue", "purple", "brown", "black"] as const;
export type BuiltinBelt = (typeof BELTS)[number];
/** A belt's id: one of the built-ins, or any id given a colour in the viewer's options. */
export type Belt = string;
export const BELT_COLORS: Record<BuiltinBelt, string> = { white: "#f2f0ea", blue: "#2457b8", purple: "#6a3a9c", brown: "#6b4226", black: "#1a1a1c" };

/** What a mannequin's materials are: the wooden pieces, the joints (balls and seams), the belt. */
export interface Paint { body: THREE.Material; joint: THREE.Material; belt: THREE.Material }

type Side = "Left" | "Right";
const SIDES: Side[] = ["Left", "Right"];

/** A hand as the mannequin last placed it: the folds (radians) and its frame. */
export interface Hand { fingers: number; thumb: number; palm: THREE.Vector3; palmNormal: THREE.Vector3; thumbSide: THREE.Vector3 }

/** The joint balls and their radii, in metres. */
export const JOINT_BALLS: Record<"Shoulder" | "Elbow" | "Wrist" | "Hip" | "Knee" | "Ankle", number> = {
  Shoulder: 0.054, Elbow: 0.041, Wrist: 0.026, Hip: 0.07, Knee: 0.053, Ankle: 0.032,
};

// GrappleMap's Neck → Head leans forward; the reference's head is upright. Its shape is turned
// back by the standing lean, so a standing figure holds its head as the reference does.
const HEAD_LEAN = Math.atan2(0.045, 0.16);
/** The fingers, from the thumb's side (index, middle, ring, little): length and place across the palm. */
const FINGERS: [number, number][] = [[0.088, 0.03], [0.096, 0.01], [0.09, -0.01], [0.072, -0.029]];
/**
 * GrappleMap's Core is a joint of the spine, behind the body's middle: about 3 cm off the line
 * from mid-hip to neck standing, 7 cm typically, over 20 slumped. The torso is laid on Core held
 * within this reach of that line (standing stays as it is), so a rounded back does not pull the abdomen and the chest away
 * from the pelvis.
 */
export const CORE_REACH = 0.035;
/** The belt's place along the pelvis (where the viewer's studio focuses it), and its knot's, ahead of the band. */
const BELT_AT = 0.3;
const KNOT_AHEAD = 0.121 - 0.012 + 0.01;

const GEO = {
  // Along MidHip → Core.
  pelvis: piece(-0.17, 0.72, {
    a: [[-0.17, 0.004], [-0.12, 0.03], [0, 0.075], [0.1, 0.12], [0.25, 0.152], [0.42, 0.158], [0.6, 0.152], [0.72, 0.146]],
    b: [[-0.17, 0.03], [0, 0.07], [0.15, 0.1], [0.3, 0.112], [0.45, 0.116], [0.72, 0.112]],
    zc: [[-0.17, 0.004], [0, 0], [0.3, -0.012], [0.5, -0.008], [0.72, -0.004]], n: 2.4, lo: 0.06, hi: 0.1,
  }),
  // Along Core → Neck. The abdomen reaches a little into the pelvis and the chest, so the seams
  // are lines, not gaps.
  abdomen: piece(-0.25, 0.19, { a: [[-0.25, 0.12], [-0.19, 0.124], [0, 0.127], [0.19, 0.13]], b: [[-0.25, 0.102], [-0.19, 0.106], [0, 0.11], [0.19, 0.108]], zc: [[0, 0.004]], n: 2.3, lo: 0.08, hi: 0.08 }),
  chest: piece(0.13, 1.05, {
    a: [[0.13, 0.132], [0.19, 0.136], [0.275, 0.145], [0.356, 0.154], [0.436, 0.162], [0.517, 0.169], [0.6, 0.174], [0.75, 0.176], [0.92, 0.175], [1, 0.17], [1.05, 0.15]],
    b: [[0.13, 0.104], [0.19, 0.115], [0.31, 0.128], [0.43, 0.137], [0.55, 0.138], [0.67, 0.133], [0.79, 0.118], [0.91, 0.096], [1.05, 0.07]],
    zc: [[0.13, 0], [0.4, 0.01], [0.55, 0.006], [0.7, -0.008], [0.9, -0.012], [1.05, -0.01]], n: 3, lo: 0.06, hi: 0.1,
  }),
  // Along Neck → Head; mostly under the head, as on the reference.
  neck: piece(-0.1, 0.55, { a: [[0, 0.066], [0.55, 0.06]], b: [[0, 0.062], [0.55, 0.058]], lo: 0.05, hi: 0.1 }),
  // Absolute metres from the head's widest section, along Neck → Head.
  head: (() => {
    const g = piece(-0.153, 0.141, {
      a: [[0.141, 0], [0.124, 0.053], [0.109, 0.07], [0.094, 0.081], [0.078, 0.088], [0.062, 0.093], [0.047, 0.095], [0.016, 0.096], [-0.016, 0.093], [-0.047, 0.088], [-0.078, 0.081], [-0.109, 0.071], [-0.125, 0.063], [-0.14, 0.05], [-0.153, 0.004]],
      b: [[0.141, 0], [0.123, 0.055], [0.108, 0.075], [0.092, 0.089], [0.077, 0.099], [0.061, 0.106], [0.046, 0.112], [0.031, 0.115], [0, 0.118], [-0.031, 0.114], [-0.061, 0.107], [-0.077, 0.101], [-0.092, 0.089], [-0.108, 0.078], [-0.13, 0.058], [-0.153, 0.004]],
      zc: [[0.141, -0.012], [0.123, -0.011], [0.1, -0.006], [0, 0], [-0.046, 0.008], [-0.077, 0.014], [-0.092, 0.024], [-0.108, 0.034], [-0.13, 0.045], [-0.153, 0.05]],
      lo: 0, hi: 0,
    }, 72, 48);
    // Over the neck as on the reference: its widest section 2 cm ahead of the neck, not GrappleMap's 4.5.
    g.translate(0, 0, -0.025);
    g.rotateX(-HEAD_LEAN);
    return g;
  })(),
  // Along Shoulder → Elbow; local z is up, a the front-to-back half width (from the top view),
  // b the up-and-down one (from the front view). The deltoid sits inside the chest's side.
  upperArm: piece(-0.12, 0.97, {
    a: [[-0.12, 0.05], [-0.04, 0.068], [0.13, 0.076], [0.27, 0.077], [0.4, 0.066], [0.53, 0.053], [0.67, 0.049], [0.8, 0.048], [0.93, 0.046], [0.97, 0.044]],
    b: [[-0.12, 0.045], [-0.04, 0.058], [0.08, 0.063], [0.2, 0.069], [0.32, 0.068], [0.37, 0.064], [0.43, 0.058], [0.49, 0.053], [0.55, 0.05], [0.66, 0.048], [0.78, 0.047], [0.9, 0.045], [0.97, 0.042]],
    lo: 0.1, hi: 0.04,
  }),
  foreArm: piece(0.04, 0.97, {
    a: [[0.04, 0.046], [0.07, 0.049], [0.22, 0.05], [0.37, 0.047], [0.52, 0.042], [0.67, 0.037], [0.83, 0.031], [0.91, 0.029], [0.97, 0.027]],
    b: [[0.04, 0.044], [0.07, 0.047], [0.22, 0.048], [0.37, 0.045], [0.52, 0.04], [0.67, 0.035], [0.83, 0.03], [0.91, 0.028], [0.97, 0.026]],
    lo: 0.06, hi: 0.04,
  }),
  // Along Hip → Knee and Knee → Ankle; local z forward.
  thigh: piece(-0.08, 0.93, {
    a: [[-0.08, 0.06], [0, 0.072], [0.077, 0.075], [0.24, 0.079], [0.4, 0.073], [0.55, 0.066], [0.71, 0.059], [0.84, 0.054], [0.93, 0.052]],
    b: [[-0.08, 0.065], [0.05, 0.087], [0.25, 0.085], [0.44, 0.08], [0.64, 0.071], [0.84, 0.06], [0.93, 0.057]],
    zc: [[0, 0], [0.5, 0.003], [0.93, 0.004]], lo: 0.12, hi: 0.05,
  }),
  shin: piece(0.07, 0.95, {
    a: [[0.07, 0.06], [0.125, 0.061], [0.29, 0.059], [0.54, 0.05], [0.63, 0.042], [0.79, 0.038], [0.92, 0.037], [0.95, 0.034]],
    b: [[0.07, 0.062], [0.125, 0.065], [0.29, 0.063], [0.54, 0.056], [0.63, 0.048], [0.79, 0.041], [0.92, 0.038], [0.95, 0.035]],
    zc: [[0.07, 0], [0.3, -0.004], [0.6, -0.006], [0.95, -0.006]], lo: 0.05, hi: 0.06,
  }),
  // Absolute metres from Heel along heel → toe, at a standard 23 cm; local z is down, the sole
  // 3 cm under the joints. The reference's ankle sits twice as high as GrappleMap's, so the foot
  // keeps its outline at about half the height.
  foot: (() => {
    const H = track([[-0.035, 0.078], [0, 0.092], [0.05, 0.094], [0.1, 0.085], [0.15, 0.072], [0.2, 0.064], [0.24, 0.06], [0.27, 0.056]]);
    const A = track([[-0.035, 0.04], [0, 0.047], [0.07, 0.053], [0.14, 0.062], [0.2, 0.066], [0.245, 0.063], [0.27, 0.056]]);
    return loft(-0.035, 0.272, (u, t) => { const k = domes(t, 0.12, 0.16), h = H(u); return { a: A(u) * k, b: (h / 2) * k, zc: 0.03 - h / 2, n: 2.4 }; }, 56, 44);
  })(),
  // Along Wrist → Hand; local z is the back of the hand.
  palm: piece(-0.04, 1.04, { a: [[-0.04, 0.032], [0.2, 0.038], [0.7, 0.044], [1.04, 0.044]], b: [[-0.04, 0.014], [0.5, 0.0145], [1.04, 0.012]], n: 2.6, lo: 0.15, hi: 0.08 }),
  // Absolute metres from Hand.
  fingers: FINGERS.map(([len]) => piece(0.004, len, { a: [[0, 0.0095], [len, 0.0085]], b: [[0, 0.0092], [len, 0.008]], lo: 0.05, hi: 0.22 }, 24, 24)),
  thumbBase: piece(-0.004, 0.046, { a: [[0, 0.0145], [0.046, 0.0125]], b: [[0, 0.0135], [0.046, 0.012]], lo: 0.15, hi: 0.12 }, 20, 24),
  thumbTip: piece(0.002, 0.036, { a: [[0, 0.0122], [0.036, 0.0098]], b: [[0, 0.0115], [0.036, 0.009]], lo: 0.08, hi: 0.32 }, 20, 24),
  // The belt: a band round the pelvis at BELT_AT, and its knot in front. Absolute metres.
  belt: piece(-0.0225, 0.0225, { a: [[0, 0.161]], b: [[0, 0.121]], zc: [[0, -0.012]], n: 2.4, lo: 0.15, hi: 0.15 }, 6, 64),
  knot: piece(-0.028, 0.028, { a: [[0, 0.032]], b: [[0, 0.014]], n: 3, lo: 0.25, hi: 0.25 }, 12, 24),
  ball: new THREE.SphereGeometry(1, 40, 28),
  pin: new THREE.CylinderGeometry(1, 1, 1, 28),
  seam: new THREE.CylinderGeometry(1, 1, 1, 40),
};

export class Mannequin {
  readonly group = new THREE.Group();
  /** Every piece by name, as placed on the last pose. */
  readonly pieces: Record<string, THREE.Mesh> = {};
  /** The hands as last placed: the fingers' and the thumb's folds, and the hand's frame. */
  readonly hands: Partial<Record<Side, Hand>> = {};
  /** Thickness, 1 for the standard body. */
  build = 1;
  private body: THREE.Mesh[] = [];
  private joints: THREE.Mesh[] = [];
  private belts: THREE.Mesh[] = [];

  constructor() {
    const mesh = (name: string, geo: THREE.BufferGeometry, kind: THREE.Mesh[]) => {
      const m = new THREE.Mesh(geo);
      m.name = name;
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      this.pieces[name] = m;
      kind.push(m);
      return m;
    };
    for (const k of ["pelvis", "abdomen", "chest", "neck", "head"] as const) mesh(k, GEO[k], this.body);
    for (const s of SIDES) {
      for (const k of ["upperArm", "foreArm", "thigh", "shin", "foot", "palm", "thumbBase", "thumbTip"] as const) mesh(s + k[0].toUpperCase() + k.slice(1), GEO[k], this.body);
      GEO.fingers.forEach((g, i) => mesh(`${s}Finger${i}`, g, this.body));
    }
    for (const s of SIDES) {
      for (const j of Object.keys(JOINT_BALLS)) mesh(`${s}${j}Ball`, GEO.ball, this.joints);
      mesh(`${s}ThumbBall`, GEO.ball, this.joints);
      mesh(`${s}ThumbBaseBall`, GEO.ball, this.joints);
      mesh(`${s}Knuckles`, GEO.pin, this.joints);
      mesh(`${s}WristSeam`, GEO.seam, this.joints);
      mesh(`${s}AnkleSeam`, GEO.seam, this.joints);
    }
    mesh("NeckBall", GEO.ball, this.joints);
    mesh("NeckSeam", GEO.seam, this.joints);
    mesh("Waist", GEO.ball, this.joints);
    mesh("belt", GEO.belt, this.belts);
    mesh("knot", GEO.knot, this.belts);
  }

  paint(p: Paint) {
    for (const m of this.body) m.material = p.body;
    for (const m of this.joints) m.material = p.joint;
    for (const m of this.belts) m.material = p.belt;
  }

  set shadows(on: boolean) {
    for (const m of this.group.children) m.castShadow = m.receiveShadow = on;
  }

  /** Places every piece from this frame's joints. */
  pose(l: Landmarks) {
    const k = this.build, M = this.pieces;
    const P = (j: string) => l[j as Joint];
    /** A piece from `from` toward `to`, scaled to the bone (or not, for pieces in absolute metres). */
    const place = (m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, across: THREE.Vector3, scaled = true) => {
      const d = new THREE.Vector3().subVectors(to, from);
      m.position.copy(from);
      m.quaternion.copy(basis(d, across));
      m.scale.set(scaled ? k : 1, scaled ? d.length() : 1, scaled ? k : 1);
    };
    const along = (m: THREE.Mesh, from: THREE.Vector3, dir: THREE.Vector3, len: number, across: THREE.Vector3) => {
      m.position.copy(from);
      m.quaternion.copy(basis(dir, across));
      m.scale.set(k, len, k);
    };
    const ball = (m: THREE.Mesh, at: THREE.Vector3, r: number) => { m.position.copy(at); m.quaternion.identity(); m.scale.setScalar(r); };
    const seam = (m: THREE.Mesh, at: THREE.Vector3, axis: THREE.Vector3, r: number, h: number) => {
      m.position.copy(at);
      m.quaternion.copy(basis(axis, new THREE.Vector3(1, 0, 0)));
      m.scale.set(r * k, h, r * k);
    };

    const spine = new THREE.Vector3().subVectors(l.Neck, l.MidHip).normalize();
    const onLine = l.MidHip.clone().addScaledVector(spine, new THREE.Vector3().subVectors(l.Core, l.MidHip).dot(spine));
    const offLine = new THREE.Vector3().subVectors(l.Core, onLine);
    if (offLine.length() > CORE_REACH) offLine.setLength(CORE_REACH);
    const core = onLine.add(offLine);

    // Across vectors chosen so every piece's local z points forward (arms: up).
    const toLeftHip = new THREE.Vector3().subVectors(l.LeftHip, l.RightHip), toLeft = new THREE.Vector3().subVectors(l.LeftShoulder, l.RightShoulder);
    const up = new THREE.Vector3().subVectors(l.Neck, core);
    const forward = new THREE.Vector3().crossVectors(toLeft, up).normalize();

    // The pelvis and the abdomen lean half-way toward the line MidHip → Neck. Core sits behind
    // that line, so laid along their bones they would meet at an angle even standing (a crooked
    // waist); this way a straight back is straight, and a bent one splits the bend between them,
    // the waist filler in the seam.
    const lowDir = new THREE.Vector3().subVectors(core, l.MidHip).normalize().add(spine).normalize();
    const midDir = new THREE.Vector3().subVectors(l.Neck, core).normalize().add(spine).normalize();
    const lowLen = l.MidHip.distanceTo(core), midLen = core.distanceTo(l.Neck);
    along(M.pelvis, l.MidHip, lowDir, lowLen, toLeftHip);
    along(M.abdomen, core, midDir, midLen, toLeft.clone().lerp(toLeftHip, 0.5));
    const pelvisTop = l.MidHip.clone().addScaledVector(lowDir, 0.72 * lowLen), abdomenBottom = core.clone().addScaledVector(midDir, -0.25 * midLen);
    M.Waist.position.copy(pelvisTop).add(abdomenBottom).multiplyScalar(0.5);
    M.Waist.quaternion.copy(basis(lowDir.clone().add(midDir), toLeftHip));
    M.Waist.scale.set(0.12 * k, Math.max(0.04, pelvisTop.distanceTo(abdomenBottom) / 2 + 0.03), 0.1 * k);
    place(M.chest, core, l.Neck, toLeft);

    // Belt: round the pelvis, the knot in front.
    const beltAt = l.MidHip.clone().addScaledVector(lowDir, BELT_AT * lowLen);
    const beltFrame = basis(lowDir, toLeftHip);
    M.belt.position.copy(beltAt);
    M.belt.quaternion.copy(beltFrame);
    M.belt.scale.set(k, 1, k);
    M.knot.position.copy(beltAt).add(new THREE.Vector3(0, 0, KNOT_AHEAD * k).applyQuaternion(beltFrame));
    M.knot.quaternion.copy(beltFrame);
    M.knot.scale.set(k, 1, k);

    place(M.neck, l.Neck, l.Head, toLeft);
    const headDir = new THREE.Vector3().subVectors(l.Head, l.Neck).normalize();
    M.head.position.copy(l.Head).addScaledVector(headDir, 0.027);
    M.head.quaternion.copy(basis(headDir, toLeft));
    M.head.scale.setScalar(1);
    seam(M.NeckSeam, l.Neck.clone().addScaledVector(headDir, 0.006), headDir, 0.067, 0.008);
    ball(M.NeckBall, l.Neck.clone().addScaledVector(headDir, 0.03), 0.058 * k);

    for (const s of SIDES) {
      const J = (j: string) => P(s + j), sign = s === "Left" ? 1 : -1;
      // Arms: across ±forward, so local z is up on both sides.
      place(M[s + "UpperArm"], J("Shoulder"), J("Elbow"), forward.clone().multiplyScalar(sign));
      place(M[s + "ForeArm"], J("Elbow"), J("Wrist"), forward.clone().multiplyScalar(sign));
      place(M[s + "Thigh"], J("Hip"), J("Knee"), toLeftHip.clone().negate());
      place(M[s + "Shin"], J("Knee"), J("Ankle"), toLeftHip.clone().negate());
      for (const [j, r] of Object.entries(JOINT_BALLS)) ball(M[`${s}${j}Ball`], J(j), r * k);
      seam(M[s + "AnkleSeam"], J("Ankle"), new THREE.Vector3().subVectors(J("Ankle"), J("Knee")), 0.031, 0.012);

      // Foot: along heel → toe, its frame as the ankle sits over it.
      const heel = J("Heel"), toe = J("Toe"), fd = new THREE.Vector3().subVectors(toe, heel);
      const footUp = new THREE.Vector3().subVectors(J("Ankle"), heel.clone().add(toe).multiplyScalar(0.5));
      const foot = M[s + "Foot"];
      foot.position.copy(heel);
      foot.quaternion.copy(basis(fd, new THREE.Vector3().crossVectors(footUp, fd)));
      foot.scale.set(k, fd.length() / 0.23, k);

      // Hand: the palm from Wrist to Hand, the four fingers from Hand on, folding there.
      const w = J("Wrist"), h = J("Hand"), f = J("Fingers");
      const d1 = new THREE.Vector3().subVectors(h, w).normalize(), d2 = new THREE.Vector3().subVectors(f, h).normalize();
      const fold = Math.acos(Math.min(1, Math.max(-1, d1.dot(d2))));
      // The palm faces where the fingers fold; a straight hand faces down from the torso, or
      // forward when it points along the spine.
      let palmN = d2.clone().addScaledVector(d1, -d2.dot(d1));
      if (palmN.length() < 0.05) palmN = up.clone().negate().addScaledVector(d1, up.dot(d1));
      if (palmN.lengthSq() < 1e-8) palmN = forward.clone();
      palmN.normalize();
      const lateral = new THREE.Vector3().crossVectors(d1, palmN).normalize();
      const thumbSide = lateral.clone().multiplyScalar(-sign);
      place(M[s + "Palm"], w, h, lateral.clone().negate());
      const across = new THREE.Vector3().crossVectors(d2, palmN).normalize().negate();
      FINGERS.forEach(([, side], i) => {
        const at = h.clone().addScaledVector(thumbSide, side).addScaledVector(d1, i === 3 ? -0.006 : 0);
        place(M[`${s}Finger${i}`], at, at.clone().add(d2), across, false);
      });
      seam(M[s + "WristSeam"], w, new THREE.Vector3().subVectors(w, J("Elbow")), 0.027, 0.01);
      // Knuckles: a pin across the hand where the fingers fold, so the fold never opens a gap.
      M[s + "Knuckles"].position.copy(h);
      M[s + "Knuckles"].quaternion.copy(basis(lateral, d1));
      M[s + "Knuckles"].scale.set(0.0108, 0.072, 0.0108);

      // Thumb: from the palm's side near the wrist, spread out in the palm's plane, one fold toward it.
      const tFold = Math.min(1.35, 0.15 + fold * 0.9);
      const base = w.clone().addScaledVector(d1, 0.022).addScaledVector(thumbSide, 0.03).addScaledVector(palmN, 0.005);
      const t1 = d1.clone().multiplyScalar(0.8).addScaledVector(thumbSide, 0.55).addScaledVector(palmN, 0.1 + fold * 0.3).normalize();
      const mid = base.clone().addScaledVector(t1, 0.046);
      const toPalm = palmN.clone().addScaledVector(t1, -palmN.dot(t1)).normalize();
      const t2 = t1.clone().multiplyScalar(Math.cos(tFold)).addScaledVector(toPalm, Math.sin(tFold));
      place(M[s + "ThumbBase"], base, base.clone().add(t1), palmN.clone().negate(), false);
      place(M[s + "ThumbTip"], mid, mid.clone().add(t2), palmN.clone().negate(), false);
      ball(M[s + "ThumbBaseBall"], base, 0.0142);
      ball(M[s + "ThumbBall"], mid, 0.0118);
      this.hands[s] = { fingers: fold, thumb: tFold, palm: w.clone().add(h).multiplyScalar(0.5), palmNormal: palmN, thumbSide };
    }
  }
}
