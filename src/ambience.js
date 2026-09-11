import { WORLD, delta, clamp, random } from "./simulation.js";
const approach = (param, value, time, smooth = 0.12) => {
  param.cancelAndHoldAtTime(time);
  param.setTargetAtTime(value, time, smooth);
};
export function spatialVoice(distance, radialVelocity, side) {
  return {
    gain: 0.014 / Math.pow(1 + distance * 0.09, 2),
    frequency: clamp(343 / (343 + radialVelocity), 0.7, 1.4),
    cutoff: 450 + 5200 / (1 + distance * 0.12),
    pan: clamp(side / (10 + distance * 0.15), -1, 1),
  };
}
export class Ambience {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.18;
    this.bus.connect(destination);
    this.events = 0;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
      data = buffer.getChannelData(0),
      rng = random(448);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
      previous = 0.75 * previous + (rng() * 2 - 1) * 0.25;
      data[i] = previous;
    }
    this.noise = buffer;
    this.insects = Array.from({ length: 5 }, () => this.voice());
    this.own = this.voice();
    this.own.pan.pan.value = 0;
    this.water = ctx.createBufferSource();
    this.water.buffer = buffer;
    this.water.loop = true;
    this.waterFilter = ctx.createBiquadFilter();
    this.waterFilter.type = "bandpass";
    this.waterFilter.frequency.value = 230;
    this.waterFilter.Q.value = 1.4;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    this.water
      .connect(this.waterFilter)
      .connect(this.waterGain)
      .connect(this.bus);
    this.water.start();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.bus.connect(this.analyser);
    this.lastTime = null;
    this.lastSim = 0;
  }
  voice() {
    const ctx = this.ctx,
      osc = ctx.createOscillator(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      pan = ctx.createStereoPanner(),
      noise = ctx.createBufferSource(),
      noiseGain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 220;
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    gain.gain.value = 0;
    noiseGain.gain.value = 0.32;
    noise.buffer = this.noise;
    noise.loop = true;
    osc.connect(filter);
    noise.connect(noiseGain).connect(filter);
    filter.connect(gain).connect(pan).connect(this.bus);
    osc.start();
    noise.start();
    return { osc, filter, gain, pan, id: null, distance: null };
  }
  update(world, bias) {
    const now = this.ctx.currentTime;
    if (this.ctx.state !== "running" || this.lastTime === now) return;
    const dt =
      this.lastTime === null ? 0.016 : Math.max(0.005, now - this.lastTime);
    this.lastTime = now;
    const candidates = world.fauna.agents
      .map((a, i) => ({
        a,
        i,
        d: Math.hypot(
          delta(a.u, world.u, WORLD.length),
          delta(a.v, world.v, WORLD.width),
          (a.altitude || 0) - world.altitude,
        ),
      }))
      .filter((o) => o.a.visible && o.a.kind !== 3 && o.d < 65)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    this.insects.forEach((voice, i) => {
      const entry = candidates[i];
      if (!entry) {
        approach(voice.gain.gain, 0, now, 0.3);
        voice.id = null;
        return;
      }
      const radial = voice.id === entry.i ? (entry.d - voice.distance) / dt : 0;
      voice.id = entry.i;
      voice.distance = entry.d;
      const pos = world.project(entry.a.u, entry.a.v, entry.a.altitude),
        p = spatialVoice(entry.d, radial, pos.x - world.observer.position.x);
      approach(
        voice.osc.frequency,
        (180 + entry.a.kind * 29) * p.frequency,
        now,
      );
      approach(voice.filter.frequency, p.cutoff, now);
      approach(voice.pan.pan, p.pan, now);
      approach(
        voice.gain.gain,
        p.gain *
          (0.65 + 0.35 * Math.sin(world.simTime * 24 + entry.a.phase) ** 2),
        now,
        0.045,
      );
    });
    const stroke = 0.5 + 0.5 * Math.abs(Math.cos(world.wingPhase || 0));
    approach(
      this.own.osc.frequency,
      215 + Math.abs(bias) * 24 + world.physics.back * 3,
      now,
      0.06,
    );
    approach(this.own.filter.frequency, 1200 + stroke * 500, now, 0.025);
    approach(this.own.gain.gain, 0.013 * stroke, now, 0.015);
    approach(this.own.pan.pan, bias * 0.14, now);
    let water = 0;
    for (const ahead of [0, 10, 20])
      for (const side of [-10, 0, 10]) {
        const u =
            world.u +
            Math.cos(world.heading) * ahead -
            Math.sin(world.heading) * side,
          v =
            world.v +
            Math.sin(world.heading) * ahead +
            Math.cos(world.heading) * side;
        if (world.height(u, v) < WORLD.seaLevel) water += 1 / 9;
      }
    approach(
      this.waterGain.gain,
      (water * 0.025) /
        (1 + Math.max(0, world.altitude - WORLD.seaLevel) * 0.07),
      now,
      0.5,
    );
    approach(
      this.waterFilter.frequency,
      220 + Math.sin(now * 3.7) * 85 + Math.sin(now * 6.2) * 35,
      now,
      0.04,
    );
  }
  event(event, world) {
    if (this.ctx.state !== "running") return;
    if (event.type === "rearrange") {
      this.whoosh(event, world);
      return;
    }
    const ctx = this.ctx,
      now = ctx.currentTime,
      explosion = event.type === "explosion",
      shot = event.type === "shot",
      duration = explosion ? 0.55 : shot ? 0.085 : 0.2;
    const env = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      pan = ctx.createStereoPanner(),
      osc = ctx.createOscillator(),
      noise = ctx.createBufferSource();
    noise.buffer = this.noise;
    filter.type = "lowpass";
    filter.frequency.value = shot ? 1800 : explosion ? 950 : 2200;
    const position = world.project(event.u, event.v, event.y);
    pan.pan.value = clamp(position.x / 25, -1, 1);
    const distance = position.distanceTo(world.observer.position),
      level = (shot ? 0.06 : explosion ? 0.12 : 0.055) / (1 + distance * 0.035);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(level, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.type = shot ? "square" : "triangle";
    osc.frequency.setValueAtTime(shot ? 1200 : explosion ? 130 : 300, now);
    osc.frequency.exponentialRampToValueAtTime(shot ? 300 : 45, now + duration);
    osc.connect(filter);
    noise.connect(filter);
    filter.connect(env).connect(pan).connect(this.bus);
    osc.start();
    noise.start();
    osc.stop(now + duration + 0.02);
    noise.stop(now + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      noise.disconnect();
      filter.disconnect();
      env.disconnect();
      pan.disconnect();
    };
    this.events++;
  }
  whoosh(event, world) {
    const ctx = this.ctx,
      now = ctx.currentTime;
    // One whisper per direction per 80 ms prevents a burst of patch changes
    // from overpowering the music. Position is taken from the rendered view.
    const position = world.project(event.u, event.v, event.y);
    const screen = position.clone().project(world.camera);
    if (screen.z > 1 || Math.abs(screen.x) > 1.2 || Math.abs(screen.y) > 1.2)
      return;
    const side = screen.x < 0 ? "left" : "right";
    this.lastWhoosh ||= {};
    if (now - (this.lastWhoosh[side] ?? -Infinity) < 0.08) return;
    this.lastWhoosh[side] = now;
    const noise = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      pan = ctx.createStereoPanner();
    noise.buffer = this.noise;
    filter.type = "bandpass";
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(event.incoming ? 400 : 1600, now);
    filter.frequency.exponentialRampToValueAtTime(
      event.incoming ? 1600 : 400,
      now + 0.4,
    );
    pan.pan.value = clamp(screen.x, -1, 1);
    const level =
      0.022 / (1 + position.distanceTo(world.observer.position) * 0.025);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.14);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    noise.connect(filter).connect(gain).connect(pan).connect(this.bus);
    noise.start();
    noise.stop(now + 0.41);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
    this.events++;
  }
  get rms() {
    const data = new Float32Array(256);
    this.analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
  }
}
