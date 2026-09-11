import { holdNow } from "./audio-param.js";
import { opusAt, modalNote } from "./opus.js";
import { MusicEvolution, QUIET_MUSIC_GAIN } from "./music-evolution.js";
import { AcidBass, ACID_DELAY } from "./acid.js";
import { RobotVoice, CHANT_BEATS, VOICE_VOLUME, vocalBar } from "./robot-voice.js";
import { random } from "./simulation.js";
export const COMBAT_BPM = 150;
// Short repeating sub phrase leaves room for the chant and acid voice.
const bassLine = [0, null, 0, null, 0, null, 12, 0, 0, null, 0, null, 0, null, 7, null];
/** An original electro / booty-bass groove, synthesized without samples. */
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
    this.chantIndex = 0;
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
    this.voice = new RobotVoice(ctx, this.bus, this.noise);
    this.acid = new AcidBass(ctx, this.bus);
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
      this.chantIndex = 0;
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
    { type = "sine", end = freq, drive = false } = {},
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
    env.connect(this.bus);
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
      if (t - this.startedAt >= ACID_DELAY) this.acid.step(this.step, t, tick, variation, phase);
      if ((s % 4 === 0 && variation.chance(s === 0 ? 1 : 0.92)) ||
          (s % 4 === 2 && variation.chance(0.12 + variation.density * 0.35)))
        this.tone(t, 155, 0.27, 0.55, { end: 43, drive: true });
      if ((s === 4 || s === 12) && variation.chance(0.96)) {
        this.noiseHit(t, 0.11, 0.34, 1850, 0, true);
        this.tone(t, 190, 0.1, 0.13, { end: 120 });
      }
      if (variation.chance(s % 2 ? 0.25 + variation.density * 0.55 : 0.92)) this.noiseHit(
        t,
        s % 4 === 2 ? 0.085 : 0.026,
        s % 2 === 0 ? 0.085 : 0.04,
        7500,
        s % 2 ? -0.25 : 0.25,
      );
      let note = bassLine[s];
      if (note === null && variation.chance(variation.density * 0.16)) note = variation.choose(7, 10);
      if (note !== null && variation.chance(s % 4 === 0 ? 0.96 : 0.68)) {
        if (s % 4 !== 0) note = variation.choose(note, note === 12 ? 7 : 12);
        const f = 440 * 2 ** ((modalNote(26 + note, phase, variation.rng) - 69) / 12);
        this.tone(t + 0.016, f, s % 4 === 0 ? 0.24 : 0.13, 0.32, { drive: true });
        this.tone(t + 0.016, f * 2, 0.14, 0.055, { type: "triangle" });
      }
      // A second, bell-like disco family enters gradually, one probabilistic note at a time.
      if (s % 2 === 1 && variation.chance(phase.familyMix * (0.16 + variation.density * 0.2))) {
        const phrase = [0, 7, 12, 9, 7, 4, 2];
        const midi = modalNote(62 + phrase[Math.floor(this.step / 2) % phrase.length], phase, variation.rng);
        this.tone(t, 440 * 2 ** ((midi - 69) / 12), 0.23, 0.055, { type: "triangle" });
      }
      this.next += tick;
      this.step++;
    }
  }
  scheduleChant(now) {
    if (now - this.startedAt < 12) return;
    const beat = 60 / COMBAT_BPM;
    if (this.chantOrigin === null) {
      const secondBeat = this.startedAt + 0.008 + beat;
      const ready = Math.max(this.startedAt + 12, now + 0.015);
      this.chantOrigin = secondBeat + Math.ceil((ready - secondBeat) / (4 * beat)) * 4 * beat;
    }
    while (true) {
      const words = vocalBar(this.chantLoop).words,
        word = words[this.chantIndex],
        time =
          this.chantOrigin + (this.chantLoop * CHANT_BEATS + word.beat) * beat;
      if (time > Math.min(now + 0.65, this.until - 0.2)) break;
      if (time >= now)
        this.voice.word(
          word.word,
          time,
          Math.min(0.85, (words[this.chantIndex + 1]?.beat ?? CHANT_BEATS) - word.beat) * beat * 0.86,
          this.variation ? modalNote(word.note, opusAt(time - this.opusOrigin()), this.variation.rng) : word.note,
        );
      this.chantIndex++;
      if (this.chantIndex === words.length) {
        this.chantIndex = 0;
        this.chantLoop++;
      }
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
      voiceLayers: 2,
      voiceVolume: VOICE_VOLUME,
      vocalLine: this.chantOrigin === null ? null : vocalBar(Math.max(0,
        Math.floor((this.ctx.currentTime - this.chantOrigin) / (CHANT_BEATS * 60 / COMBAT_BPM)))).text,
      chantPeriod: (CHANT_BEATS * 60) / COMBAT_BPM,
      voiceRms: this.voice.rms,
      notes: this.notes,
      drops: this.drops,
      rms: Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length),
    };
  }
}
