/** Critically damped automatic pace, relative to the former 1× default. */
export class FlightPace {
  constructor() {
    this.reset();
  }
  reset() {
    this.value = 0.5;
    this.velocity = 0;
  }
  update(dt, firing) {
    const target = firing ? 4 : 0.5,
      omega = firing ? 0.8 : 1.05;
    const offset = this.value - target,
      c = this.velocity + omega * offset,
      decay = Math.exp(-omega * dt);
    this.value = target + (offset + c * dt) * decay;
    this.velocity = (this.velocity - omega * c * dt) * decay;
    if (this.value < 0.5 || this.value > 4) {
      this.value = Math.max(0.5, Math.min(4, this.value));
      this.velocity = 0;
    }
    if (
      Math.abs(this.value - target) < 0.002 &&
      Math.abs(this.velocity) < 0.005
    ) {
      this.value = target;
      this.velocity = 0;
    }
    return this.value;
  }
}
