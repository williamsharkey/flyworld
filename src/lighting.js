import { Vector3 } from "three";
import { WORLD, TAU, delta } from "./simulation.js";
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
const SOLAR = new Vector3(0.13, 0.08, -1).normalize();
/** Fixed celestial direction expressed in the recentered, steered tangent frame. */
export function sunDirection(u, v, heading, centerV = v) {
  return SOLAR.clone()
    .applyAxisAngle(X, (u - 12) / WORLD.length * TAU)
    .applyAxisAngle(Z, (v - 160) / WORLD.width * TAU)
    .applyAxisAngle(Y, heading)
    .applyAxisAngle(Z, -delta(v, centerV, WORLD.width) / WORLD.width * TAU)
    .normalize();
}
