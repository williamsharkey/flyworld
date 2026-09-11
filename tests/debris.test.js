import test from "node:test";
import assert from "node:assert/strict";
import { makeDebris, stepDebris } from "../src/debris.js";
import { random, delta } from "../src/simulation.js";
import { CollisionField } from "../src/physics.js";
import { DreamSynth } from "../src/audio.js";
import { COMBAT_BPM, CombatAudio } from "../src/combat-audio.js";

test("debris starts inside the impacted voxel and moves outward with a size-dependent impulse", () => {
  const rng = random(1),
    impact = { u: 959, v: 10, y: 5 },
    box = { u: 1, v: 10, y: 5, su: 2, sv: 2, sy: 2, color: "#aaa" };
  for (let i = 0; i < 100; i++) {
    const p = makeDebris(box, impact, 5.5, rng);
    assert.ok(Math.abs(delta(p.u, box.u, 960)) <= 1);
    assert.ok(p.y >= 4 && p.y <= 6);
    assert.ok(
      delta(p.u, impact.u, 960) * p.du +
        (p.v - impact.v) * p.dv +
        (p.y - impact.y) * (p.dy - 7) >
        0,
    );
    assert.ok(p.life >= 3.5);
  }
});
test("ballistic shards fall, bounce off surfaces, and lose energy", () => {
  const field = new CollisionField();
  field.replace("ground", [
    { u: 0, v: 0, y: -1, su: 40, sv: 40, sy: 2, kind: 0 },
  ]);
  const p = {
    u: 0,
    v: 0,
    y: 1,
    du: 3,
    dv: 0,
    dy: -8,
    life: 5,
    size: 0.4,
    spin: 4,
    angle: 0,
    bounces: 0,
  };
  for (let i = 0; i < 10 && !p.bounces; i++) stepDebris(p, 0.03, field, 0);
  assert.ok(p.bounces > 0);
  assert.ok(p.dy > 0);
  assert.ok(p.dy < 8);
  assert.ok(p.du < 3);
  assert.ok(p.y >= 0);
});
test("collision and explosion sounds cannot activate bass mode", () => {
  const synth = new DreamSynth();
  let triggers = 0;
  synth.combat = { trigger: () => triggers++ };
  synth.event({ type: "contact" }, {});
  synth.event({ type: "explosion" }, {});
  assert.equal(triggers, 0);
  synth.event({ type: "shot" }, {});
  assert.equal(triggers, 1);
});
test("chant waits twelve active seconds before scheduling any syllable", () => {
  const c = Object.create(CombatAudio.prototype);
  Object.assign(c, {
    startedAt: 10,
    until: 100,
    chantOrigin: null,
    chantIndex: 0,
    chantLoop: 0,
  });
  let words = 0;
  c.voice = { word: () => words++ };
  c.scheduleChant(21.99);
  assert.equal(words, 0);
  c.scheduleChant(22.01);
  assert.ok(c.chantOrigin >= 22);
  const beatIndex = (c.chantOrigin - c.startedAt - 0.008) / (60 / COMBAT_BPM);
  assert.ok(Math.abs((beatIndex - 1) / 4 - Math.round((beatIndex - 1) / 4)) < 1e-9);
  c.scheduleChant(c.chantOrigin - 0.1);
  assert.ok(words > 0);
});

test('a projectile still hits along its remaining path when a slow frame outlasts its lifetime', async()=>{
 const {Arcade}=await import('../src/arcade.js');
 const arcade=Object.create(Arcade.prototype), field=new CollisionField();
 field.replace('wall',[{u:20,v:10,y:10,su:1,sv:4,sy:4,kind:1}]);
 const world={u:0,v:10,simTime:4,collisions:field,fauna:{agents:[]},height:()=>0,project:()=>({x:0,y:0,z:0})};
 Object.assign(arcade,{world,cooldown:0,held:false,queued:0,shots:[{u:0,v:10,y:10,du:1,dv:0,dy:0,life:2.5}],fragments:[],blasts:[],mesh:{count:0,instanceMatrix:{}}, render:()=>{}});
 let hit=null;arcade.explode=p=>{hit=p;};arcade.draw=()=>{};
 arcade.update(4,.25);
 assert.ok(hit && hit.u>19 && hit.u<21);
 assert.equal(arcade.shots.length,0);
});
