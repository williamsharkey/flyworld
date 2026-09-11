import test from "node:test";
import assert from "node:assert/strict";
import { Ecosystem, FlyBrain, WORLD, FORMS } from "../src/simulation.js";
import { Exploration } from "../src/exploration.js";
import { SCORE, scoreEvents, makeMidi } from "../src/score.js";

test("terrain is periodic, continuous, and has both riverbeds and mountains", () => {
  const e = new Ecosystem();
  let min = Infinity,
    max = -Infinity;
  for (let u = 0; u < 960; u += 8)
    for (let v = 0; v < 320; v += 8) {
      const h = e.terrainHeight(u, v);
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
  assert.ok(min < WORLD.seaLevel - 4);
  assert.ok(max > 14);
  for (const [u, v] of [
    [0, 0],
    [959.999, 319.999],
    [121.2, 18.7],
  ]) {
    assert.ok(
      Math.abs(e.terrainHeight(u, v) - e.terrainHeight(u + 960, v + 320)) <
        1e-8,
    );
  }
  assert.ok(
    Math.abs(e.terrainHeight(-0.001, 37) - e.terrainHeight(0.001, 37)) < 0.02,
  );
  assert.ok(
    Math.abs(e.terrainHeight(95, -0.001) - e.terrainHeight(95, 0.001)) < 0.02,
  );
});
test("evolution cannot move existing terrain elevations", () => {
  const e = new Ecosystem(),
    before = e.terrainHeight(64, 96);
  e.patch(4, 6).elevation += 0.8;
  e.patch(4, 6).ruggedness = 1;
  for (let i = 0; i < 50; i++) e.evolve(32, 96, 0.5, true);
  assert.equal(e.terrainHeight(64, 96), before);
});
test("visitation counts crossings, not time spent hovering", () => {
  const m = new Exploration();
  m.record(12, 160);
  for (let i = 0; i < 100; i++) m.record(12, 160);
  assert.equal(m.unique, 1);
  assert.equal(m.entries, 1);
  const index = m.index(12, 160),
    alpha = m.opacity(index);
  m.record(24, 160);
  m.record(12, 160);
  assert.ok(m.visits[index] > 1);
  assert.ok(m.opacity(index) > alpha);
  assert.equal(m.coverage, m.unique / 19200);
});
test("minimap paths interpolate through both seams without crossing the whole map", () => {
  const m = new Exploration();
  m.record(958, 318);
  m.record(2, 2);
  assert.ok(m.unique <= 4);
  assert.equal(m.visits[m.index(2, 2)], 1);
  const fine = new Exploration(),
    coarse = new Exploration();
  for (let u = 12; u <= 132; u++) fine.record(u, 160);
  coarse.record(12, 160);
  coarse.record(132, 160);
  assert.deepEqual(fine.visits, coarse.visits);
});
test("habituation reduces response to a repeated view; a new color restores surprise", () => {
  const b = new FlyBrain(),
    frame = new Uint8Array(3600);
  for (let i = 0; i < 900; i++) frame.set([180, 70, 40, 255], i * 4);
  for (let i = 0; i < 20; i++) b.step(frame, 0.1);
  const early = b.novelty;
  for (let i = 0; i < 400; i++) b.step(frame, 0.1);
  const familiar = b.novelty;
  assert.ok(familiar < early);
  for (let i = 0; i < 900; i++) frame.set([40, 90, 210, 255], i * 4);
  for (let i = 0; i < 15; i++) b.step(frame, 0.1);
  assert.ok(b.novelty > familiar);
});
test("novelty-directed selection swaps grammars and keeps a varied gene pool", () => {
  const e = new Ecosystem();
  for (let i = 0; i < 60; i++) {
    e.observe(12, 160, 0.1, 0.85);
    e.evolve(12, 160, 0.45);
  }
  assert.ok(e.swaps > 60);
  assert.ok(new Set([...e.patches.values()].map((p) => p.form)).size >= 8);
  e.exposure.fill(30);
  e.exposure[3] = 0;
  let preferred = 0;
  for (let i = 0; i < 100; i++) if (e.novelForm() === 3) preferred++;
  assert.ok(preferred > 65);
  assert.equal(FORMS.length, 12);
});
test("original score exports a valid five-track MIDI with bounded event times", () => {
  const midi = makeMidi(),
    view = new DataView(midi.buffer);
  assert.equal(new TextDecoder().decode(midi.slice(0, 4)), "MThd");
  assert.equal(view.getUint16(10), 5);
  let offset = 14,
    tracks = 0;
  while (offset < midi.length) {
    assert.equal(
      new TextDecoder().decode(midi.slice(offset, offset + 4)),
      "MTrk",
    );
    const length = view.getUint32(offset + 4);
    assert.ok(length > 0 && offset + 8 + length <= midi.length);
    assert.deepEqual(
      [...midi.slice(offset + 8 + length - 3, offset + 8 + length)],
      [255, 47, 0],
    );
    offset += 8 + length;
    tracks++;
  }
  assert.equal(tracks, 5);
  assert.equal(offset, midi.length);
  assert.equal(SCORE.bpm, 75);
  for (const e of scoreEvents()) {
    assert.ok(e.note >= 0 && e.note <= 127);
    assert.ok(e.beat >= 0 && e.beat < SCORE.beats);
    assert.ok(e.duration > 0);
  }
});
