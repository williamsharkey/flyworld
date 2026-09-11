import test from "node:test";
import assert from "node:assert/strict";
import { FlightInput } from "../src/controls.js";
import {
  FlightPhysics,
  CollisionField,
  DamageField,
  sweptBox,
  twist,
  headingRate,
  decorativeScale,
  TOUCH_REGIONS,
} from "../src/physics.js";
import { FlyBrain, Ecosystem, delta } from "../src/simulation.js";
import { aimTarget } from "../src/arcade.js";
import { spatialVoice } from "../src/ambience.js";
import * as THREE from "three";
import { VoxelTransitions, voxelScale } from "../src/transitions.js";
import { DreamSynth } from "../src/audio.js";

test("inverted vertical attention is smooth, then returns to brain control at 0.5 seconds", () => {
  for (const [key, sign] of [
    ["ArrowUp", -1],
    ["ArrowDown", 1],
    ["ArrowRight", 1],
    ["ArrowLeft", -1],
  ]) {
    const input = new FlightInput();
    input.key(key, true, 0);
    const first = input.update(0.016, 0.016, 0, 0);
    const prop = key === "ArrowUp" || key === "ArrowDown" ? "vertical" : "bias";
    assert.ok(first[prop] * sign > 0 && Math.abs(first[prop]) < 0.02);
    let held;
    for (let i = 2; i <= 60; i++) held = input.update(0.016, i * 0.016, 0, 0);
    assert.ok(held[prop] * sign > 0.5);
    input.key(key, false, 1);
    const tail = input.update(0.016, 1.1, 0.3, -0.2);
    assert.ok(tail.mix > 0 && tail.mix < held.mix);
    const released = input.update(0.016, 1.5, 0.3, -0.2);
    assert.equal(released.active, false);
    assert.equal(released.mix, 0);
    assert.equal(released.bias, 0.3);
    assert.equal(released.vertical, -0.2);
  }
});
test("each visual quadrant drives the corresponding horizontal and vertical response", () => {
  for (let q = 0; q < 4; q++) {
    const brain = new FlyBrain(),
      pixels = new Uint8Array(3600);
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < 30; x++) {
        const lit = (y >= 15 ? 0 : 2) + (x >= 15 ? 1 : 0) === q;
        pixels.set(
          lit ? [240, 180, 80, 255] : [20, 20, 20, 255],
          (y * 30 + x) * 4,
        );
      }
    for (let i = 0; i < 30; i++) brain.step(pixels, 0.1);
    assert.ok((q % 2 ? brain.steer : -brain.steer) > 0.3);
    assert.ok((q < 2 ? brain.vertical : -brain.vertical) > 0.3);
    assert.equal(brain.quadrants.indexOf(Math.max(...brain.quadrants)), q);
  }
});
test("local torus twist fixes the pivot, preserves radius, inverts, and fades before seams", () => {
  for (const h of [-9, -Math.PI, 0, 0.7, 10])
    for (const [u, v] of [
      [0, 0],
      [10, 20],
      [100, 30],
      [140, 0],
      [479, 159],
    ]) {
      const r = twist(u, v, h),
        back = twist(r.u, r.v, h, true);
      assert.ok(Math.hypot(back.u - u, back.v - v) < 1e-8);
      assert.ok(Math.abs(Math.hypot(u, v) - Math.hypot(r.u, r.v)) < 1e-8);
      if (Math.hypot(u, v) >= 136) assert.deepEqual(r, { u, v });
    }
  assert.equal(headingRate(0.04), 0);
  assert.equal(headingRate(-0.04), 0);
  assert.ok(headingRate(0.041) > 0 && headingRate(-0.041) < 0);
});
test("fast swept collisions catch a narrow obstacle across a periodic seam", () => {
  const field = new CollisionField(),
    box = { u: 1, v: 10, y: 5, su: 0.2, sv: 3, sy: 3, kind: 1 };
  field.replace("wall", [box]);
  const hit = field.cast(
    { u: 958, v: 10, y: 5 },
    { u: 5, v: 10, y: 5 },
    0.1,
    0,
  );
  assert.ok(hit && hit.t > 0 && hit.t < 1);
  assert.deepEqual(hit.normal, [-1, 0, 0]);
  field.remove("wall");
  assert.equal(
    field.cast({ u: 958, v: 10, y: 5 }, { u: 5, v: 10, y: 5 }, 0.1, 0),
    null,
  );
});
test("head contact stops forward penetration and recoils backward and upward", () => {
  const field = new CollisionField(),
    p = new FlightPhysics(0, 10, 7);
  field.replace("wall", [
    { u: 3, v: 10, y: 8, su: 1, sv: 12, sy: 10, kind: 1 },
  ]);
  let contacts = [];
  for (let i = 0; i < 15; i++)
    contacts.push(...p.step(0.03, 0, field, () => 0, i * 0.03));
  assert.ok(contacts.length > 0);
  assert.equal(contacts[0].region, "head");
  assert.ok(delta(p.u, 0, 960) < 1);
  assert.ok(p.altitude > 7);
  assert.ok(p.back > 3.2);
});
test("touch stimulation addresses four units in the correct body region", () => {
  for (const [index, region] of TOUCH_REGIONS.entries()) {
    const b = new FlyBrain();
    b.touch(region, 1);
    assert.equal(b.touchDrive.filter((x) => x > 0).length, 4);
    assert.ok(b.touchDrive.slice(index * 4, index * 4 + 4).every((x) => x > 0));
    b.step(new Uint8Array(3600), 0.1);
    assert.ok(b.touchSpikes.slice(index * 4, index * 4 + 4).some((x) => x));
  }
});
test("damage survives rebuilding and carves terrain across both seams", () => {
  const damage = new DamageField();
  damage.add(959, 319, 4, 3.5);
  assert.equal(
    damage.apply("0,0", { u: 0, v: 0, y: 4, su: 1, sv: 1, sy: 1, kind: 1 }),
    null,
  );
  const ground = { u: 0, v: 0, y: -12, su: 2, sv: 2, sy: 36, kind: 0 };
  const crater = damage.apply("0,0", ground);
  assert.ok(crater.sy < ground.sy);
  assert.ok(crater.y + crater.sy / 2 < 4);
  const water = { ...ground, kind: 2 };
  assert.deepEqual(damage.apply("0,0", water), water);
});
test("voxel animation is smooth, centered in scale, and completes in 0.4 seconds", () => {
  assert.equal(voxelScale([1, 0, 1], 1), 0);
  assert.ok(Math.abs(voxelScale([1, 0, 1], 1.2) - 0.5) < 1e-10);
  assert.equal(voxelScale([1, 0, 1], 1.4), 1);
  assert.equal(voxelScale([1, 1, 0], 1.4), 0);
  const box = { u: 2, v: 0, y: 0, su: 2, sv: 2, sy: 2, life: [0, 0, 1] };
  assert.equal(
    sweptBox({ u: 0, v: 0, y: 0 }, { u: 1.4, v: 0, y: 0 }, box, 0, 0, 0),
    null,
  );
  assert.ok(
    sweptBox({ u: 0, v: 0, y: 0 }, { u: 1.4, v: 0, y: 0 }, box, 0, 0, 0.4),
  );
  assert.equal(decorativeScale(12, 3), decorativeScale(12, 3));
  assert.notEqual(decorativeScale(12, 3), decorativeScale(12, 4));
});
test("aim assist accepts only a small forward cone, and audio follows distance and Doppler", () => {
  const front = { u: 20, v: 1, altitude: 5, kind: 1, visible: true },
    side = { ...front, v: 20 },
    behind = { ...front, u: -20 };
  assert.equal(
    aimTarget(
      { u: 0, v: 0, y: 5 },
      { u: 1, v: 0, y: 0 },
      [side, behind, front],
      0,
    ),
    front,
  );
  assert.equal(
    aimTarget({ u: 0, v: 0, y: 5 }, { u: 1, v: 0, y: 0 }, [side, behind], 0),
    null,
  );
  assert.ok(spatialVoice(5, -10, -4).frequency > 1);
  assert.ok(spatialVoice(5, 10, 4).frequency < 1);
  assert.ok(spatialVoice(50, 0, 4).gain < spatialVoice(5, 0, 4).gain);
  assert.ok(spatialVoice(5, 0, -4).pan < 0);
});
test("evolution follows a reversed heading instead of continuing to mutate the old forward direction", () => {
  const e = new Ecosystem(42);
  const keys = e.evolve(320, 160, 0.5, true, Math.PI);
  assert.equal(keys.length, 20);
  for (const key of keys) {
    const [u] = key.split(",").map(Number);
    assert.ok(u < 20 && u >= 14);
  }
});
test("score begins on audio unlock and recovers after a delayed scheduler tick", () => {
  const s = new DreamSynth();
  s.ctx = { state: "suspended", currentTime: 0 };
  s.origin = null;
  s.eventIndex = 0;
  s.loop = 0;
  const notes = [];
  s.note = (...args) => notes.push(args);
  s.schedule();
  assert.equal(notes.length, 0);
  s.ctx.state = "running";
  s.ctx.currentTime = 8;
  s.schedule();
  assert.ok(notes.length >= 7);
  const count = notes.length;
  s.ctx.currentTime = 12;
  s.schedule();
  assert.ok(notes.length > count);
});

test("population telemetry stays normalized at any flight heading", () => {
  const e = new Ecosystem(42);
  for (const heading of [undefined, 0, 2, 4]) {
    const p = e.population(12, 160, heading);
    assert.ok(Math.abs(p.shares.reduce((a, b) => a + b, 0) - 1) < 1e-10);
    assert.ok(Number.isFinite(p.fitness));
  }
});

test("outgoing voxel instances keep their centers and release colliders after 0.4 seconds", () => {
  const world = {
    scene: new THREE.Scene(),
    material: new THREE.MeshLambertMaterial(),
    collisions: new CollisionField(),
  };
  const transitions = new VoxelTransitions(world);
  const box = {
    u: 4,
    v: 6,
    y: 8,
    su: 2,
    sv: 3,
    sy: 4,
    kind: 1,
    color: "#abcdef",
    root: [6, 0, 4, 1],
    life: [0, 0, 1],
  };
  transitions.retire([box], 1);
  transitions.update(1);
  assert.equal(transitions.mesh.count, 1);
  const matrix = new THREE.Matrix4();
  transitions.mesh.getMatrixAt(0, matrix);
  assert.deepEqual(matrix.elements.slice(12, 15), [6, 8, -4]);
  assert.equal(world.collisions.owners.size, 1);
  transitions.update(1.41);
  assert.equal(transitions.mesh.count, 0);
  assert.equal(world.collisions.owners.size, 0);
  transitions.mesh.geometry.dispose();
  transitions.mesh.dispose();
  world.material.dispose();
});
