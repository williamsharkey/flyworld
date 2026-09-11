import { holdNow } from "./audio-param.js";
import { modalNote } from "./opus.js";
import { ACID_VOLUME } from "./music-evolution.js";
export const ACID_DELAY = 8;
export const ACID_PATTERN = [
  { note: 38, accent: true },
  { note: 38, tie: true },
  { note: 50, tie: true, slide: true },
  { note: 45 },
  null,
  { note: 38 },
  { note: 41, accent: true },
  { note: 45, tie: true, slide: true },
  { note: 38 },
  { note: 50, tie: true, slide: true },
  { note: 48, tie: true, slide: true },
  null,
  { note: 38, accent: true },
  { note: 41 },
  { note: 45, tie: true, slide: true },
  { note: 36 },
  { note: 38, accent: true },
  { note: 50, tie: true, slide: true },
  { note: 57, tie: true, slide: true },
  { note: 50, tie: true },
  { note: 48 },
  null,
  { note: 45, accent: true },
  { note: 41, tie: true, slide: true },
  { note: 38 },
  { note: 38, tie: true },
  { note: 50, tie: true, slide: true },
  { note: 48 },
  null,
  { note: 41, accent: true },
  { note: 36, tie: true, slide: true },
  { note: 38, tie: true, slide: true },
];
/** Monophonic acid voice: connected gates, portamento, accent and resonant drive. */
export class AcidBass {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.osc = ctx.createOscillator();
    this.osc.type = "sawtooth";
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 13;
    this.pole = ctx.createBiquadFilter();
    this.pole.type = "lowpass";
    this.pole.Q.value = 0.7;
    this.drive = ctx.createWaveShaper();
    this.drive.curve = Float32Array.from({ length: 2048 }, (_, i) =>
      Math.tanh((i / 1023.5 - 1) * 4),
    );
    this.drive.oversample = "2x";
    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = "highpass";
    this.highpass.frequency.value = 55;
    this.gate = ctx.createGain();
    this.gate.gain.value = 0;
    this.output = ctx.createGain();
    this.output.gain.value = ACID_VOLUME;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.osc
      .connect(this.filter)
      .connect(this.pole)
      .connect(this.drive)
      .connect(this.highpass)
      .connect(this.gate)
      .connect(this.output)
      .connect(destination);
    this.output.connect(this.analyser);
    this.osc.start();
    this.reset();
  }
  reset() {
    this.stop();
    this.notes = 0;
    this.slides = 0;
    this.ties = 0;
    this.frequency = 73.416;
  }
  stop() {
    const now = this.ctx.currentTime;
    for (const param of [
      this.osc.frequency,
      this.filter.frequency,
      this.filter.Q,
      this.pole.frequency,
      this.gate.gain,
    ])
      holdNow(param, now);
    this.gate.gain.setTargetAtTime(0, now, 0.045);
    this.connected = false;
  }
  step(index, time, tick, variation = null, phase = null) {
    const note = ACID_PATTERN[index % ACID_PATTERN.length],
      next = ACID_PATTERN[(index + 1) % ACID_PATTERN.length];
    if (!note) {
      this.gate.gain.setTargetAtTime(0, time, 0.014);
      this.connected = false;
      return;
    }
    const pitch = variation && !note.tie && variation.chance(0.12 + variation.color * 0.18)
        ? variation.choose(note.note + 7, note.note + 12) : note.note;
    const mapped = phase ? modalNote(pitch, phase, variation.rng) : pitch;
    const f = 440 * 2 ** ((mapped - 69) / 12),
      legato = this.connected && note.tie,
      slide = this.connected && note.slide;
    if (slide) {
      this.osc.frequency.setValueAtTime(this.frequency, time);
      this.osc.frequency.exponentialRampToValueAtTime(f, time + tick * 0.8);
      this.slides++;
    } else this.osc.frequency.setValueAtTime(f, time);
    if (legato) this.ties++;
    const sweep = 0.5 + 0.5 * Math.sin(time * 0.7),
      base = 180 + sweep * 620,
      peak = base + (note.accent ? 3800 : 1500);
    this.filter.Q.setValueAtTime(note.accent ? 18 : 11 + sweep * 4, time);
    if (!legato) {
      this.filter.frequency.setValueAtTime(peak, time);
      this.filter.frequency.exponentialRampToValueAtTime(
        base,
        time + tick * 0.92,
      );
    } else
      this.filter.frequency.exponentialRampToValueAtTime(
        base + 1100,
        time + tick * 0.85,
      );
    this.pole.frequency.setValueAtTime(peak * 1.2, time);
    this.pole.frequency.exponentialRampToValueAtTime(
      base * 1.7,
      time + tick * 0.9,
    );
    const level = note.accent ? 0.22 : 0.15;
    if (!legato) {
      this.gate.gain.setValueAtTime(0.0001, time);
      this.gate.gain.linearRampToValueAtTime(level, time + 0.004);
    } else this.gate.gain.linearRampToValueAtTime(level, time + tick * 0.2);
    this.gate.gain.exponentialRampToValueAtTime(
      next?.tie ? level * 0.8 : 0.0001,
      time + tick * (next?.tie ? 0.99 : 0.8),
    );
    this.connected = !!next?.tie;
    this.frequency = f;
    this.notes++;
  }
  get state() {
    const samples = new Float32Array(512);
    this.analyser.getFloatTimeDomainData(samples);
    return {
      volume: ACID_VOLUME,
      notes: this.notes,
      ties: this.ties,
      slides: this.slides,
      rms: Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / samples.length),
    };
  }
}
