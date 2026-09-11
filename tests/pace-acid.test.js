import test from "node:test";
import assert from "node:assert/strict";
import { FlightPace } from "../src/pace.js";
import { AcidBass, ACID_DELAY } from "../src/acid.js";

test("firing ramps from half speed to four times speed, then coasts back down", () => {
  const pace = new FlightPace();
  assert.equal(pace.value, 0.5);
  const first = pace.update(1 / 60, true);
  assert.ok(first > 0.5 && first < 0.501);
  let previous = first;
  for (let i = 1; i < 16 * 60; i++) {
    const v = pace.update(1 / 60, true);
    assert.ok(v >= previous && v <= 4);
    previous = v;
  }
  assert.equal(pace.value, 4);
  const release = pace.update(1 / 60, false);
  assert.ok(release < 4 && release > 3.999);
  for (let i = 0; i < 12 * 60; i++) pace.update(1 / 60, false);
  assert.equal(pace.value, 0.5);
});
test("automatic pace is frame-rate independent and stays bounded when firing changes rapidly", () => {
  const a = new FlightPace(),
    b = new FlightPace();
  a.update(3, true);
  for (let i = 0; i < 180; i++) b.update(1 / 60, true);
  assert.ok(Math.abs(a.value - b.value) < 1e-10);
  for (let i = 0; i < 300; i++) {
    a.update(0.07, i % 3 === 0);
    assert.ok(a.value >= 0.5 && a.value <= 4);
  }
  a.reset();
  assert.equal(a.value, 0.5);
  assert.equal(a.velocity, 0);
});
test("acid ties keep a connected gate and slides ramp pitch on the same oscillator", () => {
  const log = [];
  const param = (name) => ({
    setValueAtTime: (...v) => log.push([name, "set", ...v]),
    linearRampToValueAtTime: (...v) => log.push([name, "linear", ...v]),
    exponentialRampToValueAtTime: (...v) =>
      log.push([name, "exponential", ...v]),
    setTargetAtTime: (...v) => log.push([name, "target", ...v]),
  });
  const acid = Object.create(AcidBass.prototype);
  Object.assign(acid, {
    osc: { frequency: param("pitch") },
    filter: { frequency: param("filter"), Q: param("resonance") },
    pole: { frequency: param("pole") },
    gate: { gain: param("gate") },
    connected: false,
    frequency: 73.4,
    notes: 0,
    slides: 0,
    ties: 0,
  });
  for (let i = 0; i < 3; i++) acid.step(i, 8 + i * 0.1, 0.1);
  assert.equal(ACID_DELAY, 8);
  assert.equal(acid.notes, 3);
  assert.equal(acid.ties, 2);
  assert.equal(acid.slides, 1);
  assert.equal(
    log.filter((x) => x[0] === "gate" && x[1] === "set" && x[2] === 0.0001)
      .length,
    1,
  );
  assert.ok(
    log.some((x) => x[0] === "pitch" && x[1] === "exponential" && x[2] > 140),
  );
  acid.step(4, 8.4, 0.1);
  assert.equal(acid.connected, false);
});
