// Real poses for the mannequin, materials and environment tests: positions from graph.json.

import { decodePose } from "@bjj3d/grapplemap";
import type { Pose } from "@bjj3d/core";
import { landmarksFromPlayer, type Landmarks } from "@bjj3d/metrics";

let graph: { positions: { name: string; pose: string }[] } | null = null;

/** Both players of a named GrappleMap position, as landmarks. */
export async function positionLandmarks(name: string): Promise<Landmarks[]> {
  graph ??= await (await fetch("/graph.json")).json();
  const entry = graph!.positions.find((p) => p.name === name);
  if (!entry) throw new Error(`no position "${name}"`);
  const pose: Pose = decodePose(entry.pose);
  return pose.map(landmarksFromPlayer);
}
