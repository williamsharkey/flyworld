import test from "node:test";
import assert from "node:assert/strict";
import { RobotVoice, VOCABULARY, VERSE_BARS, CHANT, CHANT_BEATS, CHANT_WORDS, VOICE_VOLUME, vocalBar } from "../src/robot-voice.js";
import { CombatAudio, COMBAT_BPM } from "../src/combat-audio.js";
import { SCORE } from "../src/score.js";

test("every verse syllable has phonemes and has room to breathe on a two-bar grid", () => {
  assert.equal(VERSE_BARS.length, 24);
  for (const bar of VERSE_BARS) {
    assert.equal(bar.words.length, 8);
    bar.words.forEach((w, i) => {
      assert.ok(VOCABULARY.includes(w.word), w.word);
      assert.equal(w.beat, [0, .75, 1.5, 2.5, 4, 4.75, 5.5, 6.5][i]);
      assert.ok(Number.isFinite(w.note));
    });
  }
  assert.equal(CHANT_BEATS, 8);
  assert.equal(vocalBar(0), VERSE_BARS[0]);
  assert.equal(vocalBar(4).text, CHANT);
  assert.equal(vocalBar(28), VERSE_BARS[23]);
  assert.equal(vocalBar(30), VERSE_BARS[0]);
});
test("doubled voices share exact syllable timing, at two octaves apart", () => {
  const voice = Object.create(RobotVoice.prototype), calls = [];
  voice.words = 0;
  voice.part = (...args) => calls.push(args);
  voice.word("big", 12.4, 0.172, 50);
  assert.deepEqual(calls.map(c => c.slice(0, 3)), [["big", 12.4, 0.172], ["big", 12.4, 0.172]]);
  assert.deepEqual(calls.map(c => c[3]), [38, 62]);
  assert.equal(voice.words, 1);
  assert.equal(VOICE_VOLUME, 0.7);
  assert.equal(COMBAT_BPM, SCORE.bpm * 2);
});
test("scheduler cycles through every verse without late bunching or drifting off beat two", () => {
  const c = Object.create(CombatAudio.prototype), calls = [];
  Object.assign(c, { startedAt: 0, until: 200, chantOrigin: null, chantLoop: 0, chantIndex: 0,
    voice: { word: (...args) => calls.push(args) } });
  for (let now = 12; now < 114; now += 0.05) c.scheduleChant(now);
  assert.equal(calls[0][0], "big");
  assert.ok(calls.some(c => c[0] === "blow"));
  assert.ok(calls.some(c => c[0] === "sun"));
  assert.ok(calls.every((c, i) => i === 0 || c[1] > calls[i - 1][1]));
  for (const call of calls) {
    const tick = (call[1] - 0.008) / (60 / COMBAT_BPM / 4);
    assert.ok(Math.abs(tick - Math.round(tick)) < 1e-8);
  }
  calls.length = 0;
  c.scheduleChant(140);
  assert.ok(calls.every(c => c[1] >= 140));
});
