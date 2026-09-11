import test from "node:test";
import assert from "node:assert/strict";
import { MusicEvolution, ACID_VOLUME, QUIET_MUSIC_GAIN } from "../src/music-evolution.js";
import { opusAt, modalNote, MODES, OPUS_SECONDS, SONG_FAMILIES } from "../src/opus.js";
import { scoreEvents } from "../src/score.js";

test("opus visits ten modes and two families, blending continuously through the loop", () => {
  assert.equal(new Set(Array.from({length:10},(_,i)=>opusAt(i*96).mode)).size,10);
  assert.equal(SONG_FAMILIES.length,2);
  assert.equal(opusAt(0).familyMix,0); assert.equal(opusAt(48).familyMix,1);
  assert.ok(opusAt(95.999).blend > .999);
  assert.equal(opusAt(OPUS_SECONDS).index,0);
  for(let t=0;t<OPUS_SECONDS;t+=.5){
    assert.ok(Math.abs(opusAt(t).familyMix-opusAt(t+.01).familyMix)<.001);
    const phase=opusAt(t), note=modalNote(65,phase,()=>1);
    assert.ok(MODES[phase.index][1].includes((note-50)%12));
  }
});
test("probabilities wander gently and musical windows evolve reproducibly without pad resets", () => {
  const a=new MusicEvolution(1), b=new MusicEvolution(1);
  for(let i=0;i<10000;i++){ const previous=a.density; a.advance(.1); b.advance(.1);
    assert.ok(Math.abs(a.density-previous)<.01); assert.equal(a.density,b.density); }
  const first=scoreEvents(a,0), next=scoreEvents(a,102.4), other=scoreEvents(new MusicEvolution(2),0);
  assert.notDeepEqual(first,other); assert.notDeepEqual(first,next);
  assert.ok(first.some(e=>e.part==='pad' && e.beat%4!==0));
  assert.ok(next.filter(e=>e.part==='pad'&&e.beat===0).length<4);
  assert.ok(first.some(e=>e.part==='arp')&&first.some(e=>e.part==='bell'));
  assert.equal(ACID_VOLUME,.7); assert.equal(QUIET_MUSIC_GAIN,1.2);
});
