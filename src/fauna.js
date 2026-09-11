import * as THREE from "three";
import { WORLD, wrap, delta, random, TAU } from "./simulation.js";
const palettes = [
  "#e8c36d",
  "#a3d8d5",
  "#b97d91",
  "#799486",
  "#dbe8a2",
  "#dc9b6e",
];
/** A bounded flock with a periodic spatial hash; no all-pairs neighbor search. */
export class Fauna {
  constructor(scene, surface, height, seed = 772) {
    this.surface = surface;
    this.height = height;
    this.rng = random(seed);
    this.agents = [];
    this.encounters = 0;
    this.lastEncounter = -100;
    this.clock = 0;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial(),
      1000,
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.reset(12, 160);
  }
  reset(u, v) {
    this.encounters = 0;
    this.clock = 0;
    this.lastEncounter = -100;
    this.agents = Array.from({ length: 90 }, (_, i) => ({
      kind: i % 6,
      u: wrap(u + 8 + this.rng() * 110, WORLD.length),
      v: wrap(v + (this.rng() - 0.5) * 95, WORLD.width),
      vu: 0,
      vv: 0,
      phase: this.rng() * TAU,
      h: 2 + this.rng() * 7,
    }));
  }
  update(dt, u, v, centerV, ecosystem) {
    this.clock += dt;
    const cells = new Map();
    const key = (u, v) =>
      `${wrap(Math.floor(u / 16), 60)},${wrap(Math.floor(v / 16), 20)}`;
    for (const a of this.agents) {
      const k = key(a.u, a.v);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(a);
    }
    const nearby = (a) => {
      const list = [];
      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          list.push(...(cells.get(key(a.u + x * 16, a.v + y * 16)) || []));
      return list;
    };
    let count = 0;
    const put = (pos, sx, sy, sz, color, yaw = 0) => {
      const d = this.dummy;
      d.position.copy(pos);
      d.rotation.set(0, yaw, 0);
      d.scale.set(sx, sy, sz);
      d.updateMatrix();
      this.mesh.setMatrixAt(count, d.matrix);
      this.color.set(color);
      this.mesh.setColorAt(count, this.color);
      count++;
    };
    for (const a of this.agents) {
      if (
        delta(a.u, u, WORLD.length) < -22 ||
        Math.abs(delta(a.v, v, WORLD.width)) > 78
      ) {
        a.u = wrap(u + 85 + this.rng() * 35, WORLD.length);
        a.v = wrap(v + (this.rng() - 0.5) * 100, WORLD.width);
      }
      let desiredU = Math.sin(this.clock * 0.35 + a.phase) * 0.7,
        desiredV = Math.cos(this.clock * 0.4 + a.phase) * 0.8;
      const neighbors = nearby(a);
      if (a.kind === 2) {
        let nearest = null,
          distance = 32;
        for (const other of neighbors) {
          if (other.kind !== 1 && other.kind !== 3) continue;
          const d = Math.hypot(
            delta(other.u, a.u, WORLD.length),
            delta(other.v, a.v, WORLD.width),
          );
          if (d < distance) {
            distance = d;
            nearest = other;
          }
        }
        if (nearest) {
          desiredU =
            (delta(nearest.u, a.u, WORLD.length) / Math.max(distance, 1)) * 3.5;
          desiredV =
            (delta(nearest.v, a.v, WORLD.width) / Math.max(distance, 1)) * 3.5;
          if (distance < 4 && this.clock - this.lastEncounter > 2) {
            this.encounters++;
            this.lastEncounter = this.clock;
          }
        }
      } else if (a.kind === 1 || a.kind === 3) {
        let flockU = 0,
          flockV = 0,
          n = 0;
        for (const other of neighbors) {
          if (other === a) continue;
          const du = delta(other.u, a.u, WORLD.length),
            dv = delta(other.v, a.v, WORLD.width),
            d = Math.hypot(du, dv);
          if (other.kind === 2 && d < 18) {
            desiredU -= (du / Math.max(d, 1)) * (18 - d) * 0.7;
            desiredV -= (dv / Math.max(d, 1)) * (18 - d) * 0.7;
          } else if (other.kind === a.kind && d < 12) {
            flockU += du * 0.1 + other.vu * 0.25;
            flockV += dv * 0.1 + other.vv * 0.25;
            n++;
            if (d < 2) {
              desiredU -= du;
              desiredV -= dv;
            }
          }
        }
        if (n) {
          desiredU += flockU / n;
          desiredV += flockV / n;
        }
      }
      a.vu += (desiredU - a.vu) * (1 - Math.exp(-dt * 2));
      a.vv += (desiredV - a.vv) * (1 - Math.exp(-dt * 2));
      a.u = wrap(a.u + a.vu * dt, WORLD.length);
      a.v = wrap(a.v + a.vv * dt, WORLD.width);
      const p = ecosystem.patch(Math.floor(a.u / 16), Math.floor(a.v / 16));
      if (p.genes[[4, 7, 6, 5, 4, 7][a.kind]] < 0.13) continue;
      const ground = Math.max(WORLD.seaLevel, this.height(a.u, a.v));
      const alt =
        ground +
        (a.kind === 3
          ? 0.45
          : a.kind === 4
            ? 0.4
            : a.h + Math.sin(this.clock * 2 + a.phase) * 0.65);
      const pos = this.surface(a.u, a.v, alt, u, centerV),
        yaw = Math.atan2(a.vv, -a.vu),
        c = palettes[a.kind],
        size = a.kind === 2 ? 1.25 : a.kind === 1 ? 0.6 : 0.45;
      put(pos, size, 0.4 * size, size * 1.8, c, yaw);
      if (a.kind !== 3 && a.kind !== 4) {
        for (const side of [-1, 1]) {
          const flap = Math.sin(
              this.clock * (a.kind === 2 ? 10 : 24) + a.phase,
            ),
            wing = pos
              .clone()
              .add(
                new THREE.Vector3(side * size * 0.95, flap * size * 0.45, 0),
              );
          put(
            wing,
            size * 1.5,
            0.07,
            size * 0.7,
            a.kind === 2 ? "#d8b0b9" : "#e9ebd2",
            yaw,
          );
        }
      } else if (a.kind === 3) {
        for (const side of [-1, 1])
          put(
            pos
              .clone()
              .add(
                new THREE.Vector3(
                  side * 0.3,
                  -0.25,
                  Math.sin(this.clock * 8) * 0.15,
                ),
              ),
            0.12,
            0.5,
            0.12,
            c,
          );
      }
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
