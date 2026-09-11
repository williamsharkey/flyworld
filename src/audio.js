import { holdNow } from "./audio-param.js";
import { MusicEvolution, QUIET_MUSIC_GAIN } from "./music-evolution.js";
import { opusAt } from "./opus.js";
import { CombatAudio } from "./combat-audio.js";
import { Ambience } from "./ambience.js";
import { SCORE, scoreEvents } from "./score.js";
import { random } from "./simulation.js";

/** Original MIDI-style score rendered by an analog-inspired Web Audio synth. */
export class DreamSynth {
  constructor() {
    this.enabled = true;
    this.volume = 0.5;
    this.paused = false;
    this.evolution = new MusicEvolution(Math.floor(Math.random() * 2 ** 32));
    this.events = scoreEvents(this.evolution);
    this.scheduled = 0;
    this.drumEvolution = new MusicEvolution(31337);
    this.pulse = 0;
  }
  async init() {
    if (this.ctx) return;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 14;
    limiter.ratio.value = 5;
    this.master.connect(limiter).connect(ctx.destination);
    this.ambience = new Ambience(ctx, this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = QUIET_MUSIC_GAIN;
    this.musicGain.connect(this.master);
    this.combat = new CombatAudio(ctx, this.master, this.musicGain, () => this.origin ?? ctx.currentTime);
    this.bus = ctx.createGain();
    this.bus.connect(this.musicGain);
    const reverb = ctx.createConvolver(),
      buffer = ctx.createBuffer(
        2,
        Math.floor(ctx.sampleRate * 3.6),
        ctx.sampleRate,
      ),
      rng = random(1928);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++)
        data[i] = (rng() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.45;
    }
    reverb.buffer = buffer;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    this.bus.connect(reverb).connect(wet).connect(this.musicGain);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 950;
    this.filter.Q.value = 0.8;
    this.filter.connect(this.bus);
    // Twin modulated delays give the pad a wide, gently moving analog chorus.
    for (const side of [-1, 1]) {
      const delay = ctx.createDelay(0.05),
        lfo = ctx.createOscillator(),
        depth = ctx.createGain(),
        pan = ctx.createStereoPanner(),
        gain = ctx.createGain();
      delay.delayTime.value = 0.017;
      depth.gain.value = 0.0035;
      lfo.frequency.value = side < 0 ? 0.19 : 0.27;
      pan.pan.value = side * 0.7;
      gain.gain.value = 0.22;
      lfo.connect(depth).connect(delay.delayTime);
      lfo.start();
      this.filter.connect(delay).connect(pan).connect(gain).connect(this.bus);
    }
    this.sweep = ctx.createOscillator();
    const sweepDepth = ctx.createGain();
    this.sweep.frequency.value = 0.035;
    sweepDepth.gain.value = 520;
    this.sweep.connect(sweepDepth).connect(this.filter.frequency);
    this.sweep.start();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.master.connect(this.analyser);
    this.origin = null;
    this.eventIndex = 0;
    this.loop = 0;
    this.timer = setInterval(() => this.schedule(), 40);
    this.schedule();
  }
  schedule() {
    this.combat?.schedule();
    if (!this.ctx || this.ctx.state !== "running") return;
    // Start the score only when audio actually unlocks. Keep a generous buffer
    // for terrain rebuilds, and recover sustained notes after a delayed timer.
    if (this.origin === null) this.origin = this.ctx.currentTime + 0.12;
    if (this.combat) this.scheduleDisco();
    const beatSeconds = 60 / SCORE.bpm;
    while (true) {
      const event = this.events[this.eventIndex],
        time =
          this.origin + (this.loop * SCORE.beats + event.beat) * beatSeconds;
      if (time > this.ctx.currentTime + 1.2) break;
      const remaining =
        event.duration * beatSeconds - Math.max(0, this.ctx.currentTime - time);
      if (remaining > 0.1)
        this.note(event, Math.max(this.ctx.currentTime, time), remaining);
      this.eventIndex++;
      if (this.eventIndex === this.events.length) {
        this.eventIndex = 0;
        this.loop++;
        this.events = scoreEvents(this.evolution, this.loop * SCORE.beats * beatSeconds);
      }
    }
  }
  scheduleDisco() {
    const ctx = this.ctx, tick = 60 / SCORE.bpm / 2;
    if (this.origin + this.pulse * tick < ctx.currentTime - 0.08)
      this.pulse = Math.ceil((ctx.currentTime - this.origin) / tick);
    while (this.origin + this.pulse * tick < ctx.currentTime + 1.2) {
      const time = this.origin + this.pulse * tick, phase = opusAt(time - this.origin);
      const kick = this.pulse % 2 === 0;
      this.drumEvolution.advance(tick);
      if (this.drumEvolution.chance(kick ? 0.55 + phase.familyMix * 0.4 : 0.25 + phase.familyMix * 0.45)) {
        const source = kick ? ctx.createOscillator() : ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(), gain = ctx.createGain();
        if (kick) {
          source.frequency.setValueAtTime(115, time);
          source.frequency.exponentialRampToValueAtTime(47, time + 0.12);
        } else source.buffer = this.combat.noise;
        filter.type = kick ? "lowpass" : "highpass"; filter.frequency.value = kick ? 220 : 6200;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(kick ? 0.065 : 0.018, time + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + (kick ? 0.19 : 0.055));
        source.connect(filter).connect(gain).connect(this.musicGain);
        source.start(time); source.stop(time + 0.21);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      }
      this.pulse++;
    }
  }
  note(event, time, duration) {
    const ctx = this.ctx,
      pad = event.part === "pad",
      bass = event.part === "bass",
      bell = event.part === "bell";
    const env = ctx.createGain(),
      voiceFilter = ctx.createBiquadFilter();
    voiceFilter.type = "lowpass";
    voiceFilter.frequency.setValueAtTime(bass ? 320 : bell ? 2400 : 2000, time);
    voiceFilter.frequency.exponentialRampToValueAtTime(
      bass ? 140 : 700,
      time + duration,
    );
    const strength =
        (event.velocity / 127) *
        (pad ? 0.06 : bass ? 0.11 : bell ? 0.046 : 0.045),
      attack = pad ? 1.4 : bass ? 0.015 : 0.025,
      release = pad ? 2.3 : bass ? 0.15 : bell ? 1.5 : 0.35;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(strength, time + attack);
    env.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, strength * 0.65),
      time + Math.max(attack + 0.1, duration * 0.75),
    );
    env.gain.linearRampToValueAtTime(0, time + duration + release);
    env.connect(voiceFilter).connect(pad ? this.filter : this.bus);
    const oscillators = [];
    for (const detune of pad ? [-7, 7] : [0]) {
      const oscillator = ctx.createOscillator();
      oscillator.type = pad
        ? "sawtooth"
        : bass
          ? "triangle"
          : bell
            ? "sine"
            : "triangle";
      const frequency = 440 * Math.pow(2, (event.note - 69) / 12);
      oscillator.frequency.setValueAtTime(event.glide ? frequency * 0.94 : frequency, time);
      if (event.glide) oscillator.frequency.exponentialRampToValueAtTime(frequency, time + 0.12);
      oscillator.detune.value = detune;
      oscillator.connect(env);
      oscillator.start(time);
      oscillator.stop(time + duration + release + 0.02);
      oscillators.push(oscillator);
    }
    oscillators[0].onended = () => {
      oscillators.forEach((o) => o.disconnect());
      env.disconnect();
      voiceFilter.disconnect();
    };
    this.scheduled++;
  }
  async arm() {
    await this.init();
    // Arm the gain even when resume must wait for the first browser gesture.
    await this.sync();
  }
  environment(world, bias) {
    this.ambience?.update(world, bias);
  }
  event(event, world) {
    if (event.type === "shot") this.combat?.trigger();
    this.ambience?.event(event, world);
  }
  async setEnabled(enabled) {
    await this.init();
    this.enabled = enabled;
    await this.sync();
  }
  async sync() {
    if (!this.ctx) return;
    const active = this.enabled && !this.paused && !document.hidden;
    if (active) {
      holdNow(this.master.gain, this.ctx.currentTime);
      this.master.gain.setTargetAtTime(
        this.volume * 0.85,
        this.ctx.currentTime,
        1.8,
      );
      await this.ctx.resume();
      this.error = null;
      this.schedule();
    } else {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
    clearTimeout(this.sleepTimer);
    if (!active)
      this.sleepTimer = setTimeout(() => {
        if (!this.enabled || this.paused || document.hidden)
          this.ctx.suspend().catch(() => {});
      }, 800);
  }
  setVolume(value) {
    this.volume = value;
    this.sync().catch(() => {});
  }
  setPaused(value) {
    this.paused = value;
    this.sync().catch(() => {});
  }
  reward(value) {
    if (this.filter)
      this.filter.frequency.setTargetAtTime(
        650 + value * 900,
        this.ctx.currentTime,
        3,
      );
  }
  get state() {
    let rms = 0;
    if (this.analyser) {
      const samples = new Float32Array(256);
      this.analyser.getFloatTimeDomainData(samples);
      rms = Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length);
    }
    return {
      enabled: this.enabled,
      context: this.ctx?.state || "uninitialized",
      scheduled: this.scheduled,
      rms,
      volume: this.volume,
      masterGain: this.master?.gain.value ?? 0,
      error: this.error ?? null,
      opus: opusAt(this.ctx ? this.ctx.currentTime - (this.origin ?? this.ctx.currentTime) : 0),
      quietGain: this.musicGain?.gain.value ?? QUIET_MUSIC_GAIN,
      environment: this.ambience?.state,
      ambientRms: this.ambience?.rms || 0,
      soundEvents: this.ambience?.events || 0,
      combat: this.combat?.state || {
        active: false,
        notes: 0,
        drops: 0,
        rms: 0,
      },
    };
  }
}
