import { voxelScale } from "./transitions.js";
import { WORLD, wrap, delta, clamp, TAU } from "./simulation.js";

import { TOUCH_REGIONS } from "./touch.js";
export { TOUCH_REGIONS };
export const headingRate = (bias) =>
  Math.abs(bias) <= 0.04
    ? 0
    : Math.sign(bias) * (0.12 + (Math.abs(bias) - 0.04) * 0.75);
// Compactly supported polar twist: r'=r, theta'=theta-heading*f(r).
// This is invertible and area-preserving; support is smaller than the torus's
// injectivity radius (160), so both periodic seams remain untouched.
export function twist(du, dv, heading, inverse = false) {
  const radius = Math.hypot(du, dv),
    t = clamp((radius - 96) / 40),
    weight = 1 - t * t * (3 - 2 * t);
  const angle = heading * weight * (inverse ? -1 : 1),
    c = Math.cos(angle),
    s = Math.sin(angle);
  return { u: du * c + dv * s, v: dv * c - du * s };
}
export function decorativeScale(seed, index) {
  let h = Math.imul(seed ^ Math.imul(index + 1, 0x45d9f3b), 0x27d4eb2d) >>> 0;
  return 1.0003 + (h / 4294967296) * 0.0012;
}
export function sweptBox(
  start,
  end,
  box,
  radius = 0,
  time = 0,
  wallTime = Infinity,
) {
  const float =
    box.kind === 3 ? Math.sin(time * 1.5 + box.rootV * 0.15) * 0.8 : 0;
  const center = [
    delta(box.u, start.u, WORLD.length),
    delta(box.v, start.v, WORLD.width),
    box.y + float - start.y,
  ];
  const direction = [
    delta(end.u, start.u, WORLD.length),
    delta(end.v, start.v, WORLD.width),
    end.y - start.y,
  ];
  const scale = voxelScale(box.life, wallTime);
  if (scale < 0.002) return null;
  const extent = [
    (box.su * scale) / 2 + radius,
    (box.sv * scale) / 2 + radius,
    (box.sy * scale) / 2 + radius,
  ];
  let enter = 0,
    exit = 1,
    axis = -1,
    sign = 0,
    inside = true,
    penetration = Infinity,
    insideAxis = 0,
    insideSign = 1;
  for (let i = 0; i < 3; i++) {
    const lo = center[i] - extent[i],
      hi = center[i] + extent[i];
    if (lo > 0 || hi < 0) inside = false;
    const escape = extent[i] - Math.abs(center[i]);
    if (escape < penetration) {
      penetration = escape;
      insideAxis = i;
      insideSign = center[i] > 0 ? -1 : 1;
    }
    if (Math.abs(direction[i]) < 1e-9) {
      if (lo > 0 || hi < 0) return null;
      continue;
    }
    let a = lo / direction[i],
      b = hi / direction[i],
      n = -Math.sign(direction[i]);
    if (a > b) [a, b] = [b, a];
    if (a > enter) {
      enter = a;
      axis = i;
      sign = n;
    }
    exit = Math.min(exit, b);
    if (enter > exit) return null;
  }
  if (exit < 0 || enter > 1) return null;
  const normal = [0, 0, 0];
  if (inside) {
    normal[insideAxis] = insideSign;
    return { t: 0, normal, penetration: Math.max(0, penetration), box };
  }
  if (axis >= 0) normal[axis] = sign;
  return { t: Math.max(0, enter), normal, penetration: 0, box };
}
export class CollisionField {
  constructor() {
    this.cells = new Map();
    this.owners = new Map();
  }
  key(u, v) {
    return `${wrap(Math.floor(u / 4), 240)},${wrap(Math.floor(v / 4), 80)}`;
  }
  remove(owner) {
    for (const [key, box] of this.owners.get(owner) || []) {
      const set = this.cells.get(key);
      set?.delete(box);
      if (!set?.size) this.cells.delete(key);
    }
    this.owners.delete(owner);
  }
  replace(owner, boxes) {
    this.remove(owner);
    const refs = [];
    for (const box of boxes) {
      if (box.kind === 2) continue;
      const keys = new Set();
      for (
        let u = Math.floor((box.u - box.su / 2) / 4);
        u <= Math.floor((box.u + box.su / 2) / 4);
        u++
      )
        for (
          let v = Math.floor((box.v - box.sv / 2) / 4);
          v <= Math.floor((box.v + box.sv / 2) / 4);
          v++
        )
          keys.add(this.key(u * 4, v * 4));
      for (const key of keys) {
        if (!this.cells.has(key)) this.cells.set(key, new Set());
        this.cells.get(key).add(box);
        refs.push([key, box]);
      }
    }
    this.owners.set(owner, refs);
  }
  candidates(start, end, radius) {
    const boxes = new Set(),
      du = delta(end.u, start.u, WORLD.length),
      dv = delta(end.v, start.v, WORLD.width),
      steps = Math.max(1, Math.ceil(Math.hypot(du, dv) / 2));
    for (let i = 0; i <= steps; i++) {
      const u = start.u + (du * i) / steps,
        v = start.v + (dv * i) / steps;
      for (let a = -Math.ceil(radius / 4); a <= Math.ceil(radius / 4); a++)
        for (let b = -Math.ceil(radius / 4); b <= Math.ceil(radius / 4); b++)
          for (const box of this.cells.get(this.key(u + a * 4, v + b * 4)) ||
            [])
            boxes.add(box);
    }
    return boxes;
  }
  cast(start, end, radius, time) {
    let best = null;
    for (const box of this.candidates(start, end, radius)) {
      if (box.dead) continue;
      const hit = sweptBox(
        start,
        end,
        box,
        radius,
        time,
        this.wallTime ?? Infinity,
      );
      if (hit && (!best || hit.t < best.t)) best = hit;
    }
    return best;
  }
}
export class DamageField {
  constructor() {
    this.scars = new Map();
    this.count = 0;
  }
  add(u, v, y, radius) {
    const scar = {
      u: wrap(u, WORLD.length),
      v: wrap(v, WORLD.width),
      y,
      radius,
    };
    const keys = [];
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const key = `${wrap(Math.floor(u / 16) + a, 60)},${wrap(Math.floor(v / 16) + b, 20)}`;
        if (!this.scars.has(key)) this.scars.set(key, []);
        const list = this.scars.get(key);
        list.push(scar);
        if (list.length > 64) list.shift();
        keys.push(key);
      }
    this.count++;
    return keys;
  }
  apply(owner, box) {
    if (box.kind === 2) return box;
    let result = { ...box };
    for (const scar of this.scars.get(owner) || []) {
      const du = Math.max(
          0,
          Math.abs(delta(box.u, scar.u, WORLD.length)) - box.su / 2,
        ),
        dv = Math.max(
          0,
          Math.abs(delta(box.v, scar.v, WORLD.width)) - box.sv / 2,
        ),
        dy = Math.max(0, Math.abs(result.y - scar.y) - result.sy / 2);
      if (du * du + dv * dv + dy * dy > scar.radius * scar.radius) continue;
      if (box.kind === 0 && box.sy > 3) {
        const bottom = result.y - result.sy / 2,
          top = Math.min(
            result.y + result.sy / 2,
            scar.y -
              Math.sqrt(Math.max(0, scar.radius ** 2 - du ** 2 - dv ** 2)),
          );
        if (top <= bottom + 0.1) return null;
        result.y = (top + bottom) / 2;
        result.sy = top - bottom;
      } else return null;
    }
    return result;
  }
}
export function flyProbes(heading, phase = 0) {
  const probes = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      probes.push({
        region: TOUCH_REGIONS[(side < 0 ? 0 : 3) + i],
        forward: 0.3 - i * 0.45,
        lateral: side * 0.88,
        y: -0.68,
        radius: 0.18,
      });
  probes.push(
    { region: "head", forward: 1, y: 0.2, lateral: 0, radius: 0.53 },
    { region: "thorax", forward: 0.2, y: 0, lateral: 0, radius: 0.56 },
    { region: "abdomen", forward: -0.9, y: -0.1, lateral: 0, radius: 0.45 },
  );
  for (const side of [-1, 1])
    probes.push({
      region: side < 0 ? "left wing" : "right wing",
      forward: -0.05,
      lateral: side * (1.3 + Math.abs(Math.cos(phase)) * 1.3),
      y: 0.3 + Math.sin(phase) * 0.5,
      radius: 0.12,
    });
  return probes.map((p) => ({
    ...p,
    u: p.forward * Math.cos(heading) - p.lateral * Math.sin(heading),
    v: p.forward * Math.sin(heading) + p.lateral * Math.cos(heading),
  }));
}
export class FlightPhysics {
  constructor(u = 12, v = 160, altitude = 8) {
    this.u = u;
    this.v = v;
    this.altitude = altitude;
    this.heading = 0;
    this.cameraSide = 0;
    this.back = 0;
    this.lift = 0;
    this.cooldown = 0;
    this.distance = 0;
    this.contacts = 0;
    this.lastContact = null;
    this.verticalVelocity = 0;
    this.manualHeight = 0;
  }
  step(dt, bias, field, height, time = 0, vertical = 0) {
    const events = [];
    let remaining = dt;
    while (remaining > 1e-8) {
      const step = Math.min(0.035, remaining);
      remaining -= step;
      time += step;
      this.cooldown -= step;
      this.heading += headingRate(bias) * step;
      const c = Math.cos(this.heading),
        s = Math.sin(this.heading),
        speed = WORLD.length / WORLD.lapSeconds - this.back;
      const du = c * speed * step,
        dv = s * speed * step;
      const ahead = Math.max(
        WORLD.seaLevel,
        height(this.u, this.v),
        height(this.u + c * 12, this.v + s * 12),
      );
      this.verticalVelocity +=
        (vertical * 5 - this.verticalVelocity) * (1 - Math.exp(-step / 1.2));
      this.manualHeight = clamp(
        this.manualHeight + this.verticalVelocity * step,
        -10,
        24,
      );
      if (Math.abs(vertical) < 0.01) this.manualHeight *= Math.exp(-step / 9);
      const dy =
        (ahead + 7 + this.manualHeight - this.altitude) *
          (1 - Math.exp(-step / 1.2)) +
        this.lift * step;
      let earliest = null;
      for (const probe of flyProbes(this.heading, time * TAU * 11)) {
        const start = {
            u: this.u + probe.u,
            v: this.v + probe.v,
            y: this.altitude + probe.y,
          },
          end = { u: start.u + du, v: start.v + dv, y: start.y + dy };
        const hit = field.cast(start, end, probe.radius, time);
        if (hit && (!earliest || hit.t < earliest.t))
          earliest = { ...hit, probe };
      }
      let fraction = 1;
      if (earliest) {
        fraction = Math.max(0, earliest.t - 0.01);
        const [nu, nv, ny] = earliest.normal,
          push = Math.min(3, earliest.penetration + 0.06);
        this.u += nu * push;
        this.v += nv * push;
        this.altitude += ny * push;
        if (this.cooldown <= 0) {
          this.back = 10;
          this.lift = 4;
          this.cooldown = 0.7;
          this.contacts++;
          this.lastContact = earliest.probe.region;
          events.push({
            type: "contact",
            region: earliest.probe.region,
            intensity: clamp(0.35 + Math.abs(speed) / 9, 0.2, 1),
            u: this.u,
            v: this.v,
            y: this.altitude,
          });
        }
      }
      this.u = wrap(this.u + du * fraction, WORLD.length);
      this.v = wrap(this.v + dv * fraction, WORLD.width);
      this.altitude +=
        dy *
        (earliest && earliest.normal[2] < 0
          ? fraction
          : Math.max(fraction, dy > 0 ? 0.7 : 0));
      this.distance += Math.hypot(du * fraction, dv * fraction);
      this.back *= Math.exp(-step / 1.1);
      this.lift *= Math.exp(-step / 0.8);
      this.cameraSide =
        this.cameraSide * Math.exp(-step / 1.8) + bias * step * 0.8;
    }
    return events;
  }
}
