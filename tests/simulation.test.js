import test from "node:test";
import assert from "node:assert/strict";
import { Ecosystem, FlyBrain, wrap, delta, WORLD } from "../src/simulation.js";
import { surface } from "../src/world.js";

test("both toroidal seams preserve the identity and evolution of a patch", () => {
  const e = new Ecosystem(42);
  const p = e.patch(0, 0);
  p.genes[0] = 0.713;
  p.version = 6;
  assert.equal(e.patch(60, 20), p);
  assert.equal(e.patch(-60, -20), p);
  assert.equal(e.patch(120, 0).genes[0], 0.713);
  assert.equal(wrap(-1, 320), 319);
  assert.equal(delta(1, 319, 320), 2);
  assert.equal(delta(319, 1, 320), -2);
});
test("torus embedding and tangent recentering are continuous at both seams", () => {
  const a = surface(0, 0, 2, 959.99, 319.99),
    b = surface(960, 320, 2, 959.99, 319.99);
  assert.ok(a.distanceTo(b) < 1e-8);
  assert.ok(a.distanceTo(surface(959.999, 319.999, 2, 959.99, 319.99)) < 0.003);
  assert.ok(surface(17, 81, 0, 17, 81).length() < 1e-8);
});
test("seeded patches are deterministic regardless of loading order", () => {
  const a = new Ecosystem(42),
    b = new Ecosystem(42);
  a.patch(18, 12);
  b.patch(4, 1);
  assert.deepEqual(a.patch(9, 5), b.patch(9, 5));
});
test("evolution stays bounded and local, and preserves untouched patches", () => {
  const e = new Ecosystem(42),
    behind = e.patch(0, 0),
    copy = structuredClone(behind);
  for (let n = 0; n < 100; n++) e.evolve(0, 0, 0.6);
  assert.deepEqual(behind, copy);
  assert.ok(e.accepted > 0);
  assert.equal(e.trials, 800);
  for (const p of e.patches.values()) {
    assert.equal(p.genes.length, 8);
    p.genes.forEach((g) =>
      assert.ok(Number.isFinite(g) && g >= 0.06 && g <= 0.96),
    );
    assert.ok(p.fitness >= 0 && p.fitness <= 1);
  }
  e.frozen = true;
  const generation = e.generation;
  assert.deepEqual(e.evolve(0, 0), []);
  assert.equal(e.generation, generation);
  assert.equal(e.evolve(0, 0, 0.6, true).length, 20);
});
test("spiking proxy steers toward either brighter field without directional bias", () => {
  const makeEye = (left) => {
    const pixels = new Uint8Array(3600);
    for (let i = 0; i < 900; i++) {
      const lit = i % 30 < 15 === left;
      pixels.set([lit ? 240 : 20, lit ? 180 : 20, lit ? 80 : 20, 255], i * 4);
    }
    return pixels;
  };
  for (const left of [true, false]) {
    const b = new FlyBrain();
    for (let i = 0; i < 30; i++) b.step(makeEye(left), 0.1);
    assert.ok(left ? b.steer < -0.4 : b.steer > 0.4);
    assert.ok(b.rate > 0);
    assert.ok(b.dopamine >= 0 && b.dopamine <= 1);
    assert.equal(b.voltage.length, 892);
  }
});
test("dopamine-gated readout remains finite during sustained sensory input", () => {
  const b = new FlyBrain(),
    pixels = new Uint8Array(3600).fill(220);
  for (let i = 0; i < 1000; i++) b.step(pixels, 0.1);
  assert.equal(b.history.length, 100);
  assert.equal(b.spikeHistory.length, 100);
  for (const w of b.weights)
    assert.ok(Number.isFinite(w) && w >= 0.3 && w <= 1);
  assert.ok(Math.abs(b.steer) < 0.1);
  assert.equal(WORLD.length / (WORLD.length / WORLD.lapSeconds), 300);
});
