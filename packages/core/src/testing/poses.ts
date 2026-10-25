// Hand-built poses for the unit tests of the pure modules (grapplemap, contact, metrics,
// data): small, readable and independent of the database.

import { JOINTS, type Joint, type Player, type Pose, type Vec3 } from "../pose.ts";

/** A player standing upright, arms hanging and slightly bent, facing +z, hips at (x, ·, z). */
export function standing(x = 0, z = 0): Player {
  const at: Record<Joint, Vec3> = {
    Head: [0, 1.65, 0], Neck: [0, 1.45, 0], Core: [0, 1.15, 0],
    LeftShoulder: [0.2, 1.42, 0], RightShoulder: [-0.2, 1.42, 0],
    LeftElbow: [0.24, 1.14, 0.02], RightElbow: [-0.24, 1.14, 0.02],
    LeftWrist: [0.26, 0.88, 0.08], RightWrist: [-0.26, 0.88, 0.08],
    LeftHand: [0.26, 0.82, 0.1], RightHand: [-0.26, 0.82, 0.1],
    LeftFingers: [0.26, 0.76, 0.12], RightFingers: [-0.26, 0.76, 0.12],
    LeftHip: [0.1, 0.95, 0], RightHip: [-0.1, 0.95, 0],
    LeftKnee: [0.11, 0.52, 0.02], RightKnee: [-0.11, 0.52, 0.02],
    LeftAnkle: [0.12, 0.09, 0], RightAnkle: [-0.12, 0.09, 0],
    LeftHeel: [0.12, 0.03, -0.05], RightHeel: [-0.12, 0.03, -0.05],
    LeftToe: [0.12, 0.03, 0.15], RightToe: [-0.12, 0.03, 0.15],
  };
  const p = {} as Player;
  for (const j of JOINTS) p[j] = [at[j][0] + x, at[j][1], at[j][2] + z];
  return p;
}

/** Two players a metre apart: no contact. */
export const apart = (): Pose => [standing(-0.5), standing(0.5)];

/** Two players at the same place: deep overlap everywhere. */
export const overlapping = (): Pose => [standing(0), standing(0.05)];

/** A copy of a player with some joints moved. */
export function withJoints(p: Player, moves: Partial<Record<Joint, Vec3>>): Player {
  const q = {} as Player;
  for (const j of JOINTS) q[j] = [...(moves[j] ?? p[j])] as Vec3;
  return q;
}
