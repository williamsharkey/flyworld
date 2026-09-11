import { WORLD, wrap, delta, clamp } from "./simulation.js";

/** Sample actual lost voxel volume and apply an outward, size-dependent impulse. */
export function makeDebris(box, impact, radius, rng) {
  const centerU = impact.u + delta(box.u, impact.u, WORLD.length),
    centerV = impact.v + delta(box.v, impact.v, WORLD.width);
  const sample = (center, size, origin) => {
    const lo = Math.max(center - size / 2, origin - radius),
      hi = Math.min(center + size / 2, origin + radius);
    return lo + (hi - lo) * rng();
  };
  const u = sample(centerU, box.su, impact.u),
    v = sample(centerV, box.sv, impact.v),
    y = sample(box.y, box.sy, impact.y);
  let du = u - impact.u,
    dv = v - impact.v,
    dy = y - impact.y,
    d = Math.hypot(du, dv, dy);
  if (d < 0.05) {
    du = rng() - 0.5;
    dv = rng() - 0.5;
    dy = rng() - 0.3;
    d = Math.hypot(du, dv, dy) || 1;
  }
  const size = clamp(
    Math.min(box.su, box.sv, box.sy) * (0.25 + rng() * 0.35),
    0.12,
    1.2,
  );
  const impulse =
    ((22 + rng() * 12) * (1 - 0.45 * Math.min(1, d / radius))) /
    Math.sqrt(size + 0.4);
  return {
    u: wrap(u, WORLD.length),
    v: wrap(v, WORLD.width),
    y,
    du: (du / d) * impulse,
    dv: (dv / d) * impulse,
    dy: (dy / d) * impulse + 7,
    size,
    color: box.color,
    life: 3.5 + rng() * 2.5,
    angle: rng() * Math.PI * 2,
    spin: (rng() - 0.5) * 14,
    bounces: 0,
    settled: false,
  };
}
/** Swept ballistic motion with gravity, drag, restitution and surface friction. */
export function stepDebris(p, dt, field, time) {
  p.life -= dt;
  if (p.life <= 0 || p.y < -35) return false;
  if (p.settled) return true;
  const end = {
    u: wrap(p.u + p.du * dt, WORLD.length),
    v: wrap(p.v + p.dv * dt, WORLD.width),
    y: p.y + p.dy * dt - 9 * dt * dt,
  };
  p.dy -= 18 * dt;
  const drag = Math.exp(-0.18 * dt);
  p.du *= drag;
  p.dv *= drag;
  p.dy *= drag;
  // Center ray + swept displacement keeps the broad phase cheap for thousands
  // of small shards. Offset to the cube radius on contact prevents sinking.
  const hit = field.cast(p, end, 0, time);
  if (hit) {
    const [nu, nv, ny] = hit.normal;
    const t = Math.max(0, hit.t - 0.005),
      separation = Math.min(1.5, hit.penetration + 0.03 + p.size * 0.5);
    p.u = wrap(
      p.u + delta(end.u, p.u, WORLD.length) * t + nu * separation,
      WORLD.length,
    );
    p.v = wrap(
      p.v + delta(end.v, p.v, WORLD.width) * t + nv * separation,
      WORLD.width,
    );
    p.y += (end.y - p.y) * t + ny * separation;
    const toward = p.du * nu + p.dv * nv + p.dy * ny;
    if (toward < 0) {
      p.du -= 1.42 * toward * nu;
      p.dv -= 1.42 * toward * nv;
      p.dy -= 1.42 * toward * ny;
    }
    p.du *= 0.76;
    p.dv *= 0.76;
    p.spin *= 0.68;
    p.bounces++;
    if (ny > 0.5 && (Math.hypot(p.du, p.dv, p.dy) < 2 || p.bounces > 5))
      p.settled = true;
  } else Object.assign(p, end);
  p.angle += p.spin * dt;
  return true;
}
