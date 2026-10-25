// Shaping for the wooden figure (figure.ts): solids lofted along a bone from measured profiles,
// and the frame each is placed in. Internal to the package.

import * as THREE from "three";

/** Measured values along a piece: [u, value] pairs, u along the bone. */
export type Profile = [number, number][];

/** A cross-section: half width a (local x), half depth b (local z), z offset, squareness n. */
export interface Section { a: number; b: number; zc: number; n: number }

/**
 * An orthonormal frame: y along `along`, x as close to `across` as it can be. When `across` runs
 * along the bone, x is the world x (or z, for a bone along x) made square to it.
 */
export function basis(along: THREE.Vector3, across: THREE.Vector3): THREE.Quaternion {
  const y = along.clone().normalize();
  const x = across.clone().addScaledVector(y, -across.dot(y));
  if (x.lengthSq() < 1e-8) {
    const ref = Math.abs(y.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    x.copy(ref).addScaledVector(y, -ref.dot(y));
  }
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * The profile as a function of u: a monotone cubic through the measurements (Fritsch–Butland
 * slopes), smooth across them and never overshooting, so a surface shows no ridges or bulges.
 * Held flat before the first and after the last.
 */
export function track(points: Profile): (u: number) => number {
  const p = [...points].sort((a, b) => a[0] - b[0]);
  if (p.length === 1) return () => p[0][1];
  const n = p.length, d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]));
  // The harmonic mean of the neighbouring slopes where they agree; flat at a peak or a step.
  const m = p.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] > 0 ? 2 / (1 / d[i - 1] + 1 / d[i]) : 0));
  return (u) => {
    if (u <= p[0][0]) return p[0][1];
    if (u >= p[n - 1][0]) return p[n - 1][1];
    let i = 0;
    while (u > p[i + 1][0]) i++;
    const h = p[i + 1][0] - p[i][0], t = (u - p[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * p[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
}

/** Rounds a profile's ends: 0 at t = 0 and 1, full from `lo` on and up to 1 - `hi`. */
export function domes(t: number, lo: number, hi: number): number {
  let k = 1;
  if (lo > 0 && t < lo) k *= Math.sqrt(1 - ((lo - t) / lo) ** 2);
  if (hi > 0 && t > 1 - hi) k *= Math.sqrt(Math.max(0, 1 - ((t - (1 - hi)) / hi) ** 2));
  return k;
}

/**
 * A solid lofted along local y from y0 to y1, with superellipse sections. shape(u, t) gets the
 * position along y and the fraction of the piece; local z is the piece's forward (or up). Texture
 * coordinates run round the section (u) and along the piece (v), for the wood look's grain.
 */
export function loft(y0: number, y1: number, shape: (u: number, t: number) => Section, rings = 48, radial = 40): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, u = y0 + (y1 - y0) * t, { a, b, zc, n } = shape(u, t), e = 2 / n;
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      pos.push(a * Math.sign(c) * Math.abs(c) ** e, u, zc + b * Math.sign(s) * Math.abs(s) ** e);
      uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < radial; j++) {
    const p = i * (radial + 1) + j, q = p + radial + 1;
    idx.push(p, q, p + 1, p + 1, q, q + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export interface PieceSpec { a: Profile; b: Profile; zc?: Profile; n?: number; lo: number; hi: number }

/** A piece from measured profiles a(u), b(u), zc(u), its ends rounded by lo and hi. */
export function piece(y0: number, y1: number, { a, b, zc = [[0, 0]], n = 2, lo, hi }: PieceSpec, rings?: number, radial?: number): THREE.BufferGeometry {
  const A = track(a), B = track(b), Z = track(zc);
  return loft(y0, y1, (u, t) => { const k = domes(t, lo, hi); return { a: A(u) * k, b: B(u) * k, zc: Z(u), n }; }, rings, radial);
}
