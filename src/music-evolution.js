import { random, clamp } from "./simulation.js";
export const QUIET_MUSIC_GAIN = 1.2;
export const ACID_VOLUME = 0.7;
/** Slowly wandering probabilities; callers advance on musical time, never render frames. */
export class MusicEvolution {
  constructor(seed = 1928) {
    this.rng = random(seed);
    this.density = 0.55;
    this.color = 0.35;
    this.targetDensity = 0.55;
    this.targetColor = 0.35;
    this.padNext = [0, 0, 0, 0];
  }
  advance(seconds) {
    if (this.rng() < 1 - Math.exp(-seconds / 5.3)) {
      this.targetDensity = clamp(this.targetDensity + (this.rng() - 0.5) * 0.65, 0.2, 0.9);
      this.targetColor = clamp(this.targetColor + (this.rng() - 0.5) * 0.75, 0, 1);
    }
    const ease = 1 - Math.exp(-seconds / 7);
    this.density += (this.targetDensity - this.density) * ease;
    this.color += (this.targetColor - this.color) * ease;
  }
  chance(probability) { return this.rng() < probability; }
  choose(a, b) { return this.chance(this.color) ? b : a; }
}
