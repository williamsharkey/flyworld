import * as THREE from "three";
import { WORLD, wrap, delta, clamp, TAU, random } from "./simulation.js";
export function aimTarget(origin, direction, agents, time) {
  let best = null,
    bestScore = Infinity;
  for (const a of agents) {
    if (
      a.deadUntil > time ||
      a.visible === false ||
      a.kind === 3 ||
      !Number.isFinite(a.altitude)
    )
      continue;
    const du = delta(a.u, origin.u, WORLD.length),
      dv = delta(a.v, origin.v, WORLD.width),
      dy = a.altitude - origin.y,
      d = Math.hypot(du, dv, dy);
    if (d < 2 || d > 80) continue;
    const dot = (du * direction.u + dv * direction.v + dy * direction.y) / d;
    if (dot < 0.975) continue;
    const score = d + (1 - dot) * 600;
    if (score < bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}
export class Arcade {
  constructor(world) {
    this.world = world;
    this.shots = [];
    this.fragments = [];
    this.held = false;
    this.queued = 0;
    this.cooldown = 0;
    this.discovered = false;
    this.fired = 0;
    this.destroyed = 0;
    this.hits = 0;
    this.rng = random(2991);
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      1600,
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    world.scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
  }
  press() {
    this.discovered = true;
    this.held = true;
    this.queued = Math.max(this.queued, 3);
  }
  release() {
    this.held = false;
  }
  reset() {
    this.shots = [];
    this.fragments = [];
    this.held = false;
    this.queued = 0;
    this.cooldown = 0;
    this.discovered = false;
    this.fired = 0;
    this.destroyed = 0;
    this.hits = 0;
    this.mesh.count = 0;
  }
  burst() {
    const w = this.world;
    for (const spread of [-0.065, 0, 0.065]) {
      if (this.shots.length >= 96) break;
      const angle = w.heading + spread,
        direction = { u: Math.cos(angle), v: Math.sin(angle), y: 0 };
      const shot = {
        u: wrap(w.u + direction.u * 2, WORLD.length),
        v: wrap(w.v + direction.v * 2, WORLD.width),
        y: w.altitude + 0.2,
        du: direction.u,
        dv: direction.v,
        dy: 0,
        life: 2.5,
        target: null,
      };
      if (spread === 0)
        shot.target = aimTarget(shot, direction, w.fauna.agents, w.simTime);
      this.shots.push(shot);
      this.fired++;
    }
    w.events.push({ type: "shot", u: w.u, v: w.v, y: w.altitude });
  }
  explode(point, radius = 3.5) {
    const w = this.world,
      damaged = [];
    for (const box of w.collisions.candidates(point, point, radius)) {
      const du = Math.max(
          0,
          Math.abs(delta(box.u, point.u, WORLD.length)) - box.su / 2,
        ),
        dv = Math.max(
          0,
          Math.abs(delta(box.v, point.v, WORLD.width)) - box.sv / 2,
        ),
        dy = Math.max(0, Math.abs(box.y - point.y) - box.sy / 2);
      if (!box.dead && du * du + dv * dv + dy * dy < radius * radius)
        damaged.push(box);
    }
    this.destroyed += damaged.length;
    const keys = w.damage.add(point.u, point.v, point.y, radius);
    keys.forEach((k) => w.dirty.add(k));
    for (const box of damaged) {
      const next = w.damage.apply(box.owner, box);
      if (next) {
        box.y = next.y;
        box.sy = next.sy;
      } else box.dead = true;
    }
    const count = Math.min(100, 18 + damaged.length * 3);
    for (let i = 0; i < count; i++) {
      const c = damaged[i % Math.max(1, damaged.length)];
      this.fragments.push({
        u: point.u,
        v: point.v,
        y: point.y,
        du: (this.rng() - 0.5) * 12,
        dv: (this.rng() - 0.5) * 12,
        dy: 2 + this.rng() * 9,
        life: 2 + this.rng() * 2,
        size: 0.1 + this.rng() * 0.36,
        color: c?.color || "#efd69a",
      });
    }
    if (this.fragments.length > 1200)
      this.fragments.splice(0, this.fragments.length - 1200);
    for (const a of w.fauna.agents) {
      if (a.deadUntil > w.simTime || !Number.isFinite(a.altitude)) continue;
      if (
        Math.hypot(
          delta(a.u, point.u, WORLD.length),
          delta(a.v, point.v, WORLD.width),
          a.altitude - point.y,
        ) <
        radius + 1
      ) {
        a.deadUntil = w.simTime + 24;
        a.visible = false;
        this.hits++;
      }
    }
    w.events.push({
      type: "explosion",
      ...point,
      intensity: Math.min(1, 0.3 + damaged.length / 30),
    });
  }
  update(dt, realDt) {
    const w = this.world;
    if (dt > 0) {
      this.cooldown -= realDt;
      if ((this.held || this.queued > 0) && this.cooldown <= 0) {
        this.burst();
        this.queued = Math.max(0, this.queued - 1);
        this.cooldown = 0.115;
      }
      const survivors = [];
      for (const shot of this.shots) {
        shot.life -= dt;
        if (shot.life <= 0) continue;
        if (shot.target && !(shot.target.deadUntil > w.simTime)) {
          const a = shot.target,
            du = delta(a.u + a.vu * 0.1, shot.u, WORLD.length),
            dv = delta(a.v + a.vv * 0.1, shot.v, WORLD.width),
            dy = a.altitude - shot.y,
            d = Math.hypot(du, dv, dy) || 1;
          const turn = 1 - Math.exp(-dt * 2.2);
          shot.du += (du / d - shot.du) * turn;
          shot.dv += (dv / d - shot.dv) * turn;
          shot.dy += (dy / d - shot.dy) * turn;
          const n = Math.hypot(shot.du, shot.dv, shot.dy);
          shot.du /= n;
          shot.dv /= n;
          shot.dy /= n;
        }
        const end = {
          u: wrap(shot.u + shot.du * 48 * dt, WORLD.length),
          v: wrap(shot.v + shot.dv * 48 * dt, WORLD.width),
          y: shot.y + shot.dy * 48 * dt,
        };
        let hit = w.collisions.cast(shot, end, 0.18, w.simTime);
        for (const a of w.fauna.agents) {
          if (
            a.deadUntil > w.simTime ||
            a.visible === false ||
            !Number.isFinite(a.altitude)
          )
            continue;
          const du = delta(end.u, shot.u, WORLD.length),
            dv = delta(end.v, shot.v, WORLD.width),
            dy = end.y - shot.y,
            au = delta(a.u, shot.u, WORLD.length),
            av = delta(a.v, shot.v, WORLD.width),
            ay = a.altitude - shot.y;
          const t = clamp(
            (au * du + av * dv + ay * dy) / (du * du + dv * dv + dy * dy || 1),
          );
          if (
            Math.hypot(au - du * t, av - dv * t, ay - dy * t) < 1.1 &&
            (!hit || t < hit.t)
          )
            hit = { t };
        }
        if (hit) {
          this.explode({
            u: wrap(
              shot.u + delta(end.u, shot.u, WORLD.length) * hit.t,
              WORLD.length,
            ),
            v: wrap(
              shot.v + delta(end.v, shot.v, WORLD.width) * hit.t,
              WORLD.width,
            ),
            y: shot.y + (end.y - shot.y) * hit.t,
          });
          continue;
        }
        Object.assign(shot, end);
        survivors.push(shot);
      }
      this.shots = survivors;
      this.fragments = this.fragments.filter((p) => {
        p.life -= dt;
        p.u = wrap(p.u + p.du * dt, WORLD.length);
        p.v = wrap(p.v + p.dv * dt, WORLD.width);
        p.y += p.dy * dt;
        p.dy -= 6 * dt;
        return p.life > 0 && p.y > -35;
      });
    }
    let count = 0;
    const put = (u, v, y, size, color, stretch = 1, angle = 0) => {
      if (count >= 1600) return;
      const d = this.dummy;
      d.position.copy(w.project(u, v, y));
      d.rotation.set(0, angle, 0);
      d.scale.set(size, size, size * stretch);
      d.updateMatrix();
      this.mesh.setMatrixAt(count, d.matrix);
      this.color.set(color);
      this.mesh.setColorAt(count, this.color);
      count++;
    };
    for (const shot of this.shots) {
      put(shot.u, shot.v, shot.y, 0.22, "#fff1be", 5);
      put(
        shot.u - shot.du * 0.9,
        shot.v - shot.dv * 0.9,
        shot.y - shot.dy * 0.9,
        0.3,
        "#e9a75b",
        3,
      );
    }
    for (const p of this.fragments)
      put(p.u, p.v, p.y, p.size * Math.min(1, p.life), p.color, 1, p.life * 3);
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
