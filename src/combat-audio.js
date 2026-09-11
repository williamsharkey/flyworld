import { RobotVoice, CHANT_WORDS } from "./robot-voice.js";
import { random } from "./simulation.js";
export const COMBAT_BPM = 145;
const bassLine = [
  0,
  null,
  0,
  12,
  null,
  7,
  0,
  null,
  0,
  10,
  null,
  7,
  0,
  null,
  12,
  7,
];
/** An original electro / booty-bass groove, synthesized without samples. */
export class CombatAudio {
  constructor(ctx, destination, musicGain) {
    this.ctx = ctx;
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
    this.curve = Float32Array.from({ length: 2048 }, (_, i) =>
      Math.tanh((i / 1023.5 - 1) * 3),
    );
  }
  trigger() {
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime,
      fresh = now > this.until;
    this.until = now + 3;
    this.bus.gain.cancelAndHoldAtTime(now);
    this.bus.gain.setTargetAtTime(0.95, now, 0.035);
    this.musicGain.gain.cancelAndHoldAtTime(now);
    this.musicGain.gain.setTargetAtTime(0.12, now, 0.055);
    if (fresh) {
      this.startedAt = now;
      this.chantOrigin = null;
      this.chantIndex = 0;
      this.chantLoop = 0;
      this.voice.stop();
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
        this.musicGain.gain.setTargetAtTime(1, now, 0.7);
        this.ducked = false;
        this.voice.stop();
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
      if ([0, 3, 6, 8, 11, 14].includes(s))
        this.tone(t, 150, 0.32, 0.55, { end: 43, drive: true });
      if (s === 4 || s === 12) {
        this.noiseHit(t, 0.17, 0.32, 1700, 0, true);
        this.tone(t, 190, 0.1, 0.13, { end: 120 });
      }
      this.noiseHit(
        t,
        s % 4 === 2 ? 0.12 : 0.035,
        s % 2 === 0 ? 0.085 : 0.04,
        7500,
        s % 2 ? -0.25 : 0.25,
      );
      const note = bassLine[s];
      if (note !== null) {
        const f = 440 * 2 ** ((26 + note - 69) / 12);
        this.tone(t + 0.016, f, 0.19, 0.32, { drive: true });
        this.tone(t + 0.016, f * 2, 0.14, 0.055, { type: "triangle" });
      }
      this.next += tick;
      this.step++;
    }
  }
  scheduleChant(now) {
    if (now - this.startedAt < 12) return;
    const beat = 60 / COMBAT_BPM;
    if (this.chantOrigin === null) this.chantOrigin = now + 0.03;
    while (true) {
      const word = CHANT_WORDS[this.chantIndex],
        time = this.chantOrigin + (this.chantLoop * 8 + word.beat) * beat;
      if (time > Math.min(now + 0.4, this.until - 0.2)) break;
      if (time >= now - 0.1)
        this.voice.word(
          word.word,
          Math.max(time, now),
          word.word === "fuck" || word.word === "ing"
            ? beat * 0.43
            : beat * 0.64,
          word.note,
        );
      this.chantIndex++;
      if (this.chantIndex === CHANT_WORDS.length) {
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
      elapsed:
        this.ctx.currentTime <= this.until
          ? this.ctx.currentTime - this.startedAt
          : 0,
      chanting: this.chantOrigin !== null && this.ctx.currentTime <= this.until,
      voiceWords: this.voice.words,
      voiceRms: this.voice.rms,
      notes: this.notes,
      drops: this.drops,
      rms: Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length),
    };
  }
}
