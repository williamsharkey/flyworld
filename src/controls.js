import { clamp } from "./simulation.js";
/** Keyboard attention is an inertial nudge, not an instantaneous heading command. */
export class FlightInput {
  constructor() {
    this.keys = new Set();
    this.lastInput = -Infinity;
    this.horizontal = 0;
    this.vertical = 0;
    this.mix = 0;
    this.releaseMix = 0;
  }
  key(code, down, now) {
    if (!code.startsWith("Arrow")) return false;
    if (down) this.keys.add(code);
    else this.keys.delete(code);
    this.lastInput = now;
    if (!down && this.keys.size === 0) this.releaseMix = this.mix;
    return true;
  }
  clear() {
    this.keys.clear();
    this.lastInput = -Infinity;
  }
  update(dt, now, brainBias, brainVertical = 0) {
    const held = this.keys.size > 0;
    if (held) this.lastInput = now;
    const active = held || now - this.lastInput < 0.5;
    const h =
      (this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("ArrowLeft") ? 1 : 0);
    const v =
      (this.keys.has("ArrowDown") ? 1 : 0) - (this.keys.has("ArrowUp") ? 1 : 0);
    const smooth = 1 - Math.exp(-dt / 0.32),
      release = 1 - Math.exp(-dt / 0.45);
    this.horizontal += (h - this.horizontal) * (held ? smooth : release);
    this.vertical += (v - this.vertical) * (held ? smooth : release);
    if (held) this.mix += (1 - this.mix) * (1 - Math.exp(-dt / 0.25));
    else {
      const t = clamp((now - this.lastInput) / 0.5);
      this.mix = this.releaseMix * (1 - t * t * (3 - 2 * t));
    }
    return {
      bias: clamp(
        brainBias * (1 - this.mix * 0.8) + this.horizontal * this.mix * 0.72,
        -1,
        1,
      ),
      vertical: clamp(
        brainVertical * (1 - this.mix * 0.8) + this.vertical * this.mix,
        -1,
        1,
      ),
      active,
      mix: this.mix,
    };
  }
}
