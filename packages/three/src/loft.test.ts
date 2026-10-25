import * as THREE from "three";
import { describe, expect, test } from "vitest";
import { basis, domes, loft, piece, track } from "./loft.ts";

const axes = (q: THREE.Quaternion) => [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((v) => v.applyQuaternion(q));

describe("basis", () => {
  test("puts y along the bone and x as close to across as it can", () => {
    const [x, y] = axes(basis(new THREE.Vector3(0, 2, 0), new THREE.Vector3(1, 1, 0)));
    expect(y.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-9);
    expect(x.distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-9);
  });

  test("still makes a frame when across runs along the bone", () => {
    // Along y: x falls back to the world x.
    const [x1, y1, z1] = axes(basis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 3, 0)));
    expect(x1.distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-9);
    expect(Math.abs(x1.dot(y1)) + Math.abs(x1.dot(z1))).toBeLessThan(1e-9);
    // Along x: the world x is the bone itself, so x falls back to the world z.
    const [x2, y2] = axes(basis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(2, 0, 0)));
    expect(y2.distanceTo(new THREE.Vector3(-1, 0, 0))).toBeLessThan(1e-9);
    expect(x2.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-9);
  });
});

describe("track", () => {
  test("goes through every measurement, in any order, and holds flat outside them", () => {
    const f = track([[1, 3], [0, 1], [0.5, 2]]);
    expect(f(0)).toBe(1);
    expect(f(0.5)).toBeCloseTo(2, 12);
    expect(f(1)).toBe(3);
    expect(f(-1)).toBe(1);
    expect(f(2)).toBe(3);
  });

  test("never overshoots: monotone between rising measurements, flat at a peak", () => {
    const rise = track([[0, 0], [0.1, 0.9], [1, 1]]);
    let prev = -Infinity;
    for (let u = 0; u <= 1; u += 0.01) { const v = rise(u); expect(v).toBeGreaterThanOrEqual(prev - 1e-12); expect(v).toBeLessThanOrEqual(1 + 1e-12); prev = v; }
    const peak = track([[0, 0], [0.5, 1], [1, 0]]);
    for (let u = 0; u <= 1; u += 0.01) expect(peak(u)).toBeLessThanOrEqual(1 + 1e-12);
  });

  test("a single measurement is a constant", () => {
    expect(track([[0.3, 0.05]])(7)).toBe(0.05);
  });
});

describe("domes", () => {
  test("rounds both ends to zero and leaves the middle whole", () => {
    expect(domes(0, 0.1, 0.1)).toBe(0);
    expect(domes(1, 0.1, 0.1)).toBeCloseTo(0, 6);
    expect(domes(0.5, 0.1, 0.1)).toBe(1);
    expect(domes(0.05, 0.1, 0.1)).toBeCloseTo(Math.sqrt(0.75), 12);
    // No rounding asked for: the ends stay whole.
    expect(domes(0, 0, 0)).toBe(1);
    expect(domes(1, 0, 0)).toBe(1);
  });
});

describe("loft and piece", () => {
  test("a loft is a closed grid of sections along y", () => {
    const g = loft(0, 2, () => ({ a: 1, b: 0.5, zc: 0.25, n: 2 }), 4, 8);
    const p = g.attributes.position;
    expect(p.count).toBe(5 * 9);
    expect(g.index!.count).toBe(4 * 8 * 6);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.y).toBe(0);
    expect(box.max.y).toBe(2);
    expect(box.max.x).toBeCloseTo(1, 6);
    expect(box.max.z).toBeCloseTo(0.75, 6);
    expect(box.min.z).toBeCloseTo(-0.25, 6);
    // Texture coordinates: round the section, then along the piece.
    const uv = g.attributes.uv;
    expect([uv.getX(0), uv.getY(0)]).toEqual([0, 0]);
    expect([uv.getX(8), uv.getY(8)]).toEqual([1, 0]);
    expect(uv.getY(p.count - 1)).toBe(1);
  });

  test("its faces point outward", () => {
    const g = loft(0, 1, () => ({ a: 1, b: 1, zc: 0, n: 2 }), 2, 16);
    const p = g.attributes.position, nrm = g.attributes.normal;
    const i = 9 + 4; // the middle ring, a quarter of the way round
    const out = new THREE.Vector3(p.getX(i), 0, p.getZ(i)).normalize();
    expect(new THREE.Vector3(nrm.getX(i), nrm.getY(i), nrm.getZ(i)).dot(out)).toBeGreaterThan(0.9);
  });

  test("a squarer section reaches further into its corners", () => {
    const corner = (n: number) => {
      const g = loft(0, 1, () => ({ a: 1, b: 1, zc: 0, n }), 1, 8);
      const p = g.attributes.position;
      return Math.hypot(p.getX(1), p.getZ(1)); // 45°
    };
    expect(corner(2)).toBeCloseTo(1, 6);
    expect(corner(4)).toBeGreaterThan(1.1);
  });

  test("a piece follows its profiles and rounds its ends", () => {
    const g = piece(0, 1, { a: [[0, 0.1], [1, 0.2]], b: [[0, 0.05]], zc: [[0, 0.01]], n: 2, lo: 0.2, hi: 0 }, 10, 8);
    const p = g.attributes.position;
    // First ring closed by the dome; last ring whole, at the measured width.
    expect(Math.abs(p.getX(0))).toBeLessThan(1e-9);
    expect(p.getX(10 * 9)).toBeCloseTo(0.2, 6);
    expect(p.getZ(10 * 9 + 2)).toBeCloseTo(0.06, 6);
    // zc and n default to centred and elliptical.
    const plain = piece(0, 1, { a: [[0, 0.1]], b: [[0, 0.1]], lo: 0, hi: 0 }, 1, 8);
    expect(plain.attributes.position.getZ(2)).toBeCloseTo(0.1, 6);
  });
});
