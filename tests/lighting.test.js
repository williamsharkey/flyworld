import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { sunDirection } from '../src/lighting.js';
import { DreamSynth } from '../src/audio.js';

test('celestial direction wraps across both torus seams and follows steering',()=>{
 const a=sunDirection(70,33,.8,30), u=sunDirection(1030,33,.8,30), v=sunDirection(70,353,.8,350);
 assert.ok(a.distanceTo(u)<1e-10);assert.ok(a.distanceTo(v)<1e-10);assert.ok(Math.abs(a.length()-1)<1e-12);
 const initial=sunDirection(12,160,0), turned=sunDirection(12,160,.7);
 assert.ok(initial.clone().applyAxisAngle(new Vector3(0,1,0),.7).distanceTo(turned)<1e-10);
 assert.ok(sunDirection(12,240,0).distanceTo(initial)>.05);
});
test('master fade is armed before awaiting a browser-blocked audio resume',async()=>{
 const synth=new DreamSynth(), calls=[];
 let resume;
 synth.ctx={currentTime:0,resume:()=>{calls.push('resume');return new Promise(r=>resume=r);}};
 synth.master={gain:{cancelAndHoldAtTime:()=>{},setTargetAtTime:()=>calls.push('gain')}};
 synth.schedule=()=>calls.push('schedule');
 const before=globalThis.document;globalThis.document={hidden:false};
 try{const pending=synth.sync();assert.deepEqual(calls,['gain','resume']);resume();await pending;assert.deepEqual(calls,['gain','resume','schedule']);}
 finally{globalThis.document=before;}
});

test('audio automation fallback holds the current value without the optional method', async()=>{
 const {holdNow}=await import('../src/audio-param.js'), calls=[];
 holdNow({value:.37,cancelScheduledValues:t=>calls.push(['cancel',t]),setValueAtTime:(v,t)=>calls.push(['hold',v,t])},8);
 assert.deepEqual(calls,[['cancel',8],['hold',.37,8]]);
});
