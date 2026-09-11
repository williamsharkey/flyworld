import { holdNow } from "./audio-param.js";
import { opusAt, modalNote } from "./opus.js";
import { MusicEvolution, QUIET_MUSIC_GAIN } from "./music-evolution.js";
import { AcidBass, ACID_DELAY } from "./acid.js";
import { RobotVoice, VOICE_VOLUME } from "./robot-voice.js";
import { CHANT_BEATS, SONG_SLOTS, SONG_FAMILIES, songSlot } from "./song-form.js";
import { random } from "./simulation.js";
export const COMBAT_BPM = 150;
// Short repeating sub phrase leaves room for the chant and acid voice.
const bassLine = [0, null, 0, null, 0, null, 12, 0, 0, null, 0, null, 0, null, 7, null];
/** Original electro groove with local neural vocals and evolving song sections. */
export class CombatAudio {
  constructor(ctx, destination, musicGain, opusOrigin = () => 0) {
    this.opusOrigin = opusOrigin;
    this.ctx = ctx;
    this.variation = new MusicEvolution(Math.floor(Math.random() * 2 ** 32));
    this.musicGain = musicGain;
    this.until = -Infinity;
    this.next = 0;
    this.step = 0;
    this.notes = 0;
    this.drops = 0;
    this.startedAt = Infinity;
    this.chantOrigin = null;
    this.family = 0;
    this.chapter = 0;
    this.nextChapters = [0, 0];
    this.sectionEnergy = .8;
    this.chantLoop = 0;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.bus.connect(this.analyser);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0),
      rng = random(145808);
    for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
    this.voice = new RobotVoice(ctx, this.bus);
    this.detailBus = ctx.createGain();
    this.detailBus.connect(this.bus);
    this.acid = new AcidBass(ctx, this.detailBus);
    this.curve = Float32Array.from({ length: 2048 }, (_, i) =>
      Math.tanh((i / 1023.5 - 1) * 3),
    );
  }
  trigger() {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime,
      fresh = now > this.until;
    this.until = now + 3;
    holdNow(this.bus.gain, now);
    this.bus.gain.setTargetAtTime(0.95, now, 0.035);
    holdNow(this.musicGain.gain, now);
    this.musicGain.gain.setTargetAtTime(0.12, now, 0.055);
    if (fresh) {
      this.startedAt = now;
      this.chantOrigin = null;
      this.family = opusAt(now - this.opusOrigin()).familyMix > .5 ? 1 : 0;
      this.chapter = this.nextChapters[this.family];
      this.sectionEnergy = .8;
      this.voice.load();
      this.chantLoop = 0;
      this.voice.stop();
      this.acid.reset();
      this.step = 0;
      this.next = now + 0.008;
      this.drop(now);
      this.drops++;
    }
    this.schedule();
  }
  tone(
    time,
    freq,
    duration,
    level,
    { type = "sine", end = freq, drive = false, destination = this.bus } = {},
  ) {
    const ctx = this.ctx,
      osc = ctx.createOscillator(),
      env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(
      end,
      time + Math.min(0.18, duration * 0.6),
    );
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(level, time + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    let shape;
    if (drive) {
      shape = ctx.createWaveShaper();
      shape.curve = this.curve;
      shape.oversample = "2x";
      osc.connect(shape).connect(env);
    } else osc.connect(env);
    env.connect(destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      shape?.disconnect();
      env.disconnect();
    };
    this.notes++;
  }
  noiseHit(time, duration, level, frequency, pan = 0, clap = false) {
    const ctx = this.ctx,
      noise = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      env = ctx.createGain(),
      stereo = ctx.createStereoPanner();
    noise.buffer = this.noise;
    filter.type = clap ? "bandpass" : "highpass";
    filter.frequency.value = frequency;
    filter.Q.value = clap ? 0.8 : 0.5;
    stereo.pan.value = pan;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(level, time + 0.002);
    if (clap) {
      for (const offset of [0.013, 0.027]) {
        env.gain.setValueAtTime(level * 0.15, time + offset);
        env.gain.linearRampToValueAtTime(level, time + offset + 0.003);
      }
    }
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    noise.connect(filter).connect(env).connect(stereo).connect(this.bus);
    noise.start(time);
    noise.stop(time + duration + 0.01);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      env.disconnect();
      stereo.disconnect();
    };
    this.notes++;
  }
  drop(time) {
    this.tone(time, 180, 0.85, 0.42, { end: 36, drive: true });
    this.tone(time, 380, 0.55, 0.12, {
      type: "sawtooth",
      end: 48,
      drive: true,
    });
    this.noiseHit(time, 0.42, 0.1, 5000, 0);
  }
  schedule() {
    const now = this.ctx.currentTime;
    if (this.ctx.state !== "running") return;
    if (now > this.until) {
      if (this.ducked) {
        this.bus.gain.setTargetAtTime(0, now, 0.35);
        this.musicGain.gain.setTargetAtTime(QUIET_MUSIC_GAIN, now, 0.7);
        this.ducked = false;
        this.voice.stop();
        this.acid.stop();
        this.chantOrigin = null;
      }
      return;
    }
    this.ducked = true;
    this.scheduleChant(now);
    const tick = 60 / COMBAT_BPM / 4;
    if (this.next < now - 0.08) {
      const skipped = Math.ceil((now - this.next) / tick);
      this.next += skipped * tick;
      this.step += skipped;
    }
    while (this.next < Math.min(now + 0.65, this.until)) {
      const t = Math.max(now, this.next),
        s = this.step % 16;
      const variation = this.variation, phase = opusAt(t - this.opusOrigin());
      variation.advance(tick);
      const arrangement = this.arrangementAt(t);
      this.sectionEnergy += (arrangement.energy - this.sectionEnergy) * .045;
      const energy = this.sectionEnergy, speaking = this.voice.activeAt(t);
      // Make room around the consonants without raising the vocal level.
      this.detailBus.gain.setTargetAtTime((speaking ? .6 : 1) * energy, t, .09);
      if (t - this.startedAt >= ACID_DELAY) this.acid.step(this.step, t, tick, variation, phase);
      if ((s % 4 === 0 && variation.chance(s === 0 ? 1 : .55 + energy * .37)) ||
          (s % 4 === 2 && variation.chance((.12 + variation.density * .35) * energy)))
        this.tone(t, 155, 0.27, 0.55, { end: 43, drive: true });
      if ((s === 4 || s === 12) && variation.chance(.55 + energy * .41)) {
        this.noiseHit(t, 0.11, 0.34, 1850, 0, true);
        this.tone(t, 190, 0.1, 0.13, { end: 120 });
      }
      if (variation.chance(s % 2 ? (.25 + variation.density * .55) * energy : .65 + energy * .27)) this.noiseHit(
        t,
        s % 4 === 2 ? 0.085 : 0.026,
        s % 2 === 0 ? 0.085 : 0.04,
        7500,
        s % 2 ? -0.25 : 0.25,
      );
      const secondBass = [0, null, 7, null, 0, null, 12, null, 0, 7, null, null, 0, null, 5, 7];
      let note = variation.chance(phase.familyMix) ? secondBass[s] : bassLine[s];
      if (note === null && variation.chance(variation.density * 0.16)) note = variation.choose(7, 10);
      if (note !== null && variation.chance(s % 4 === 0 ? 0.96 : 0.68)) {
        if (s % 4 !== 0) note = variation.choose(note, note === 12 ? 7 : 12);
        const f = 440 * 2 ** ((modalNote(26 + note, phase, variation.rng) - 69) / 12);
        this.tone(t + 0.016, f, s % 4 === 0 ? 0.24 : 0.13, 0.32, { drive: true });
        this.tone(t + 0.016, f * 2, 0.14, 0.055, { type: "triangle" });
      }
      // A second, bell-like disco family enters gradually, one probabilistic note at a time.
      if (s % 2 === 1 && variation.chance(phase.familyMix * (0.16 + variation.density * 0.2))) {
        const phrases = [[0, 7, 12, 9, 7, 4, 2], [7, 4, 2, 0, 2, 7, 9], [12, 9, 7, 4, 7, 2, 0]];
        const phrase = phrases[arrangement.chapter % phrases.length];
        const midi = modalNote(62 + phrase[Math.floor(this.step / 2) % phrase.length], phase, variation.rng);
        this.tone(t, 440 * 2 ** ((midi - 69) / 12), 0.23, 0.055, { type: "triangle", destination: this.detailBus });
      }
      // Short answers occupy the breathing spaces instead of competing with words.
      if (!speaking && s % 4 === 2 && variation.chance(.15 + energy * .18)) {
        const answer = [[7, 5, 3, 0], [0, 3, 7, 10], [12, 7, 5, 3]][arrangement.chapter];
        const midi = modalNote(62 + answer[Math.floor(this.step / 4) % 4], phase, variation.rng);
        this.tone(t, 440 * 2 ** ((midi - 69) / 12), .19, .045,
          { type: this.family ? "triangle" : "sine", destination: this.detailBus });
      }
      this.next += tick;
      this.step++;
    }
  }
  arrangementAt(time) {
    const index = this.chantOrigin === null ? 0 : Math.max(0,
      Math.floor((time - this.chantOrigin) / (CHANT_BEATS * 60 / COMBAT_BPM)));
    return this.arrangementForSlot(index);
  }
  arrangementForSlot(index) {
    const cycle = Math.floor(index / SONG_SLOTS);
    const time = this.chantOrigin + cycle * SONG_SLOTS * CHANT_BEATS * 60 / COMBAT_BPM;
    const family = cycle && this.opusOrigin
      ? (opusAt(time - this.opusOrigin()).familyMix > .5 ? 1 : 0) : this.family ?? 0;
    return songSlot(index, family, this.chapter ?? 0);
  }
  scheduleChant(now) {
    if (now - this.startedAt < 12 || !this.voice.ready) return;
    const beat = 60 / COMBAT_BPM, period = CHANT_BEATS * beat;
    if (this.chantOrigin === null) {
      const secondBeat = this.startedAt + 0.008 + beat;
      const ready = Math.max(this.startedAt + 12, now + 0.015);
      this.chantOrigin = secondBeat + Math.ceil((ready - secondBeat) / (4 * beat)) * 4 * beat;
    }
    // A stalled frame skips expired phrases rather than compressing words together.
    this.chantLoop = Math.max(this.chantLoop, Math.ceil((now - this.chantOrigin) / period));
    while (true) {
      const time = this.chantOrigin + this.chantLoop * period;
      if (time > Math.min(now + .65, this.until - .2)) break;
      const arrangement = this.arrangementForSlot(this.chantLoop);
      if (arrangement.line && this.voice.line(arrangement.line.id, time) && this.nextChapters)
        this.nextChapters[arrangement.family] = (arrangement.chapter + 1) % 3;
      this.chantLoop++;
    }
  }
  get state() {
    const data = new Float32Array(512);
    this.analyser.getFloatTimeDomainData(data);
    return {
      active: this.ctx.currentTime <= this.until,
      bpm: COMBAT_BPM,
      acid: {
        ...this.acid.state,
        active:
          this.ctx.currentTime <= this.until &&
          this.ctx.currentTime - this.startedAt >= ACID_DELAY,
      },
      elapsed:
        this.ctx.currentTime <= this.until
          ? this.ctx.currentTime - this.startedAt
          : 0,
      chanting: this.chantOrigin !== null && this.ctx.currentTime <= this.until,
      voiceWords: this.voice.words,
      voiceLayers: 3,
      voiceReady: this.voice.ready,
      voiceError: this.voice.error,
      voiceEngine: this.voice.manifest?.engine ?? "Kokoro-82M (loading)",
      voiceLines: this.voice.lines,
      songFamily: SONG_FAMILIES[this.arrangementAt(this.ctx.currentTime).family],
      songSection: this.arrangementAt(this.ctx.currentTime).section,
      songChapter: this.arrangementAt(this.ctx.currentTime).chapter + 1,
      voiceVolume: VOICE_VOLUME,
      vocalLine: this.chantOrigin === null || this.ctx.currentTime < this.chantOrigin
        ? null : this.arrangementAt(this.ctx.currentTime).line?.text ?? null,
      chantPeriod: (CHANT_BEATS * 60) / COMBAT_BPM,
      voiceRms: this.voice.rms,
      notes: this.notes,
      drops: this.drops,
      rms: Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length),
    };
  }
}
