// A player's GrappleMap joints as three.js vectors, plus the point between the hips.

import * as THREE from "three";
import type { Joint, Player } from "./grapplemap.ts";

export type Landmarks = Record<Joint | "MidHip", THREE.Vector3>;

export function landmarksFromPlayer(p: Player): Landmarks {
  const l = {} as Landmarks;
  for (const [k, v] of Object.entries(p)) l[k as Joint] = new THREE.Vector3(...v);
  l.MidHip = l.LeftHip.clone().add(l.RightHip).multiplyScalar(0.5);
  return l;
}
