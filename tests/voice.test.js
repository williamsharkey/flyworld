import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { RobotVoice, VOICE_VOLUME } from "../src/robot-voice.js";
import { lyrics, songSlot, CHANT_BEATS, SONG_SLOTS } from "../src/song-form.js";
import { CombatAudio, COMBAT_BPM } from "../src/combat-audio.js";
import { SCORE } from "../src/score.js";
const manifest = JSON.parse(readFileSync(new URL('../public/audio/vocals.json', import.meta.url)));

test("both song families traverse three complete verses, hooks, bridges and instrumental answers", () => {
  assert.equal(lyrics.length, 60);
  for (let family = 0; family < 2; family++) {
    const heard = new Set();
    for (let i = 0; i < SONG_SLOTS * 3; i++) {
      const section = songSlot(i, family);
      if (section.line) heard.add(section.line.id);
    }
    assert.equal(heard.size, 30);
    assert.equal(songSlot(0, family).section, 'verse');
    assert.equal(songSlot(8, family).line, null);
    assert.equal(songSlot(10, family).section, 'hook');
    assert.equal(songSlot(14, family).section, 'bridge');
    assert.equal(songSlot(16, family).line, null);
    assert.notEqual(songSlot(0, family, 0).line.id, songSlot(0, family, 1).line.id);
  }
  assert.equal(CHANT_BEATS, 8);
  assert.equal(COMBAT_BPM, SCORE.bpm * 2);
});
test("every lyric has a matching non-overlapping audio slice and the shipped atlas matches its checksum", () => {
  assert.equal(Object.keys(manifest.clips).length, lyrics.length);
  const audio = readFileSync(new URL('../public/audio/vocals.mp3', import.meta.url));
  assert.equal(createHash('sha256').update(audio).digest('hex'), manifest.sha256);
  let end = 0;
  for (const line of lyrics) {
    const clip = manifest.clips[line.id];
    assert.equal(clip.text, line.text);
    assert.ok(clip.offset >= end - 1e-9);
    assert.equal(clip.duration, CHANT_BEATS * 60 / COMBAT_BPM);
    assert.ok(clip.speechDuration < clip.duration);
    assert.ok(clip.rms > .04 && clip.rms < .3);
    end = clip.offset + clip.duration;
  }
  assert.equal(VOICE_VOLUME / .7, .55);
  assert.ok(manifest.layers.lead > 8 * (manifest.layers.lowerOctave + manifest.layers.upperOctave));
});
function scheduler() {
  const c = Object.create(CombatAudio.prototype), calls = [];
  Object.assign(c, { startedAt: 0, until: 1000, chantOrigin: null, chantLoop: 0,
    family: 0, chapter: 0, nextChapters: [0, 0],
    voice: { ready: true, line: (...args) => { calls.push(args); return true; } } });
  return { c, calls };
}
test("phrases start on beat two without late bunching; chapter progress survives a firing session", () => {
  const {c, calls} = scheduler();
  for (let now = 12; now < 190; now += .05) c.scheduleChant(now);
  assert.equal(calls[0][0], '0-verse-00');
  assert.ok(calls.some(c => c[0] === '0-verse-23'));
  assert.ok(calls.some(c => c[0] === '0-hook-02'));
  assert.ok(calls.every((c, i) => i === 0 || c[1] - calls[i - 1][1] >= 3.2 - 1e-8));
  for (const call of calls) {
    const bar = ((call[1] - .008) / (60 / COMBAT_BPM) - 1) / 4;
    assert.ok(Math.abs(bar - Math.round(bar)) < 1e-8);
  }
  calls.length = 0; c.scheduleChant(240);
  assert.ok(calls.every(c => c[1] >= 240));
  c.chapter = c.nextChapters[0]; c.chantOrigin = null; c.chantLoop = 0; c.startedAt = 241;
  c.scheduleChant(253); c.scheduleChant(c.chantOrigin - .1);
  assert.equal(calls.at(-1)[0], songSlot(0, 0, c.chapter).line.id);
});
test("late audio loading waits for a new beat-aligned verse instead of queuing missed speech", () => {
  const {c, calls} = scheduler();
  c.voice.ready = false; c.scheduleChant(20);
  assert.equal(c.chantOrigin, null); assert.equal(calls.length, 0);
  c.voice.ready = true; c.scheduleChant(27);
  c.scheduleChant(c.chantOrigin - .1);
  assert.equal(calls[0][0], '0-verse-00');
  assert.ok(calls[0][1] >= 27);
});
function mockContext() {
  const sources = [];
  const ctx = { currentTime: 0, createAnalyser: () => ({ getFloatTimeDomainData() {} }),
    createGain: () => ({ gain: {}, connect() {} }),
    decodeAudioData: async () => ({ duration: 192 }),
    createBufferSource: () => {
      const source = { connect() {}, disconnect() {}, start(...args) { this.started = args; }, stop() { this.stopped = true; } };
      sources.push(source); return source;
    } };
  return {ctx, sources};
}
test("neural phrases load once, retain their pitch and stop queued audio when firing ends", async () => {
  const {ctx, sources} = mockContext(); let requests = 0;
  const fetcher = async url => { requests++; return { ok: true, json: async () => manifest, arrayBuffer: async () => new ArrayBuffer(4) }; };
  const voice = new RobotVoice(ctx, {}, {base: '/flyworld/', fetcher});
  assert.equal(voice.line('0-verse-00', 1), false);
  await voice.load(); await voice.load();
  assert.equal(requests, 2); assert.equal(voice.ready, true);
  assert.equal(voice.gain.gain.value, 1.4 * .7 * .55);
  assert.equal(voice.line('0-verse-00', 1), true);
  assert.deepEqual(sources[0].started, [1, 0, 3.2]);
  assert.equal(voice.activeAt(.9), false); assert.equal(voice.activeAt(1.1), true);
  voice.stop(); assert.equal(sources[0].stopped, true); assert.equal(voice.activeAt(1.1), false);
  ctx.currentTime = 4;
  assert.equal(voice.line('0-verse-00', 2), false);
});
test("failed vocal fetch is contained and a later firing session can retry", async () => {
  const {ctx} = mockContext(); let fail = true;
  const voice = new RobotVoice(ctx, {}, {fetcher: async () => ({ok: !fail, json: async () => manifest, arrayBuffer: async () => new ArrayBuffer(4)})});
  assert.equal(await voice.load(), false); assert.ok(voice.error);
  fail = false; assert.equal(await voice.load(), true); assert.equal(voice.error, null);
});
