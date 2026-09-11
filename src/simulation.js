export const TAU = Math.PI * 2;
export const WORLD = {
  length: 960,
  width: 320,
  chunk: 16,
  lapSeconds: 300,
  seaLevel: -1,
};
export const wrap = (n, size) => ((n % size) + size) % size;
export const delta = (a, b, size) => wrap(a - b + size / 2, size) - size / 2;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const SPECIES = [
  {
    name: "Velvet moss",
    short: "Moss",
    color: "#a9bb79",
    role: "Ground cover",
    description: "Stores light and feeds grazers. Tree shade helps it spread.",
  },
  {
    name: "Amber canopy",
    short: "Canopy",
    color: "#dfb76c",
    role: "Shelter",
    description: "Shelters moss. Pollinators reward it with new growth.",
  },
  {
    name: "Lilac coral",
    short: "Coral",
    color: "#bb9bc5",
    role: "Nectar source",
    description: "Feeds pollinators and adds branching visual contrast.",
  },
  {
    name: "Sunstone",
    short: "Crystal",
    color: "#e19470",
    role: "Mineral structure",
    description: "Competes for space while creating bright visual landmarks.",
  },
  {
    name: "Drifters",
    short: "Drifter",
    color: "#d8df9d",
    role: "Pollinator",
    description: "Seeks nectar from coral and helps the canopy reproduce.",
  },
  {
    name: "Pebble grazers",
    short: "Grazer",
    color: "#7ca89b",
    role: "Herbivore",
    description: "Consumes moss, frees growing space, and returns nutrients.",
  },
];
export const FORMS = [
  "Amber groves",
  "Coral gardens",
  "Crystal fans",
  "Giant mushrooms",
  "Stone arches",
  "Floating isles",
  "Spiral towers",
  "Flower meadows",
  "Basalt pillars",
  "Reed marshes",
  "Luminous rings",
  "Branching ruins",
];
SPECIES.push(
  {
    name: "Velvet hunters",
    short: "Hunter",
    color: "#cf8c91",
    role: "Predator",
    description:
      "Pursues nearby flies and grazers; prey scatters and reforms behind it.",
  },
  {
    name: "Wandering flies",
    short: "Kin",
    color: "#abd2d0",
    role: "Flocking explorer",
    description:
      "Flocks with neighbors, visits nectar, and flees approaching hunters.",
  },
);
// A bounded, persistent genome per toroidal patch. Rendering never owns world state.
export class Ecosystem {
  constructor(seed = 82401) {
    this.seed = seed;
    this.rng = random(seed);
    this.patches = new Map();
    this.generation = 1;
    this.accepted = 0;
    this.trials = 0;
    this.mutation = 0.55;
    this.frozen = false;
    this.exposure = new Float32Array(FORMS.length);
    this.formReward = new Float32Array(FORMS.length).fill(0.5);
    this.novelty = 1;
    this.swaps = 0;
    this.lastEvent = "A small world. An open-ended experiment.";
  }
  key(u, v) {
    return `${wrap(u, 60)},${wrap(v, 20)}`;
  }
  patch(u, v) {
    const key = this.key(u, v);
    if (!this.patches.has(key)) {
      const [a, b] = key.split(",").map(Number),
        rng = random(this.seed + a * 7919 + b * 104729);
      this.patches.set(key, {
        u: a,
        v: b,
        seed: Math.floor(rng() * 1e9),
        genes: Array.from(
          { length: SPECIES.length },
          (_, i) => 0.2 + rng() * (i < 4 ? 0.65 : 0.45),
        ),
        height: 0.3 + rng() * 0.65,
        hue: rng(),
        elevation: (rng() - 0.5) * 1.3,
        ruggedness: rng(),
        form: Math.floor(rng() * FORMS.length),
        motion: rng(),
        age: 0,
        fitness: 0,
        version: 0,
      });
    }
    return this.patches.get(key);
  }
  baseHeight(u, v) {
    const a = (wrap(u, WORLD.length) / WORLD.length) * TAU;
    const b = (wrap(v, WORLD.width) / WORLD.width) * TAU;
    const phase = (this.seed % 101) * 0.013;
    const riverCenter = 160 + 20 * Math.sin(a * 3) + 13 * Math.sin(a * 7);
    const riverDistance = delta(v, riverCenter, WORLD.width);
    const channel = Math.exp(-Math.pow(riverDistance / 8.5, 2));
    const ridge = Math.pow(Math.max(0, Math.sin(a * 3 + b * 2 + phase)), 3);
    return (
      1.5 +
      Math.sin(a * 5 + b * 2) * 3.4 +
      Math.cos(b * 3 - a * 2) * 2.2 +
      ridge * 13 -
      channel * 10
    );
  }
  terrainHeight(u, v) {
    // Smooth interpolation of periodic elevation genes avoids patch-border cracks.
    u = wrap(u, WORLD.length) / 16;
    v = wrap(v, WORLD.width) / 16;
    const a = Math.floor(u),
      b = Math.floor(v);
    const smooth = (x) => x * x * (3 - 2 * x);
    const x = smooth(u - a),
      y = smooth(v - b);
    const p = this.patch(a, b),
      q = this.patch(a + 1, b),
      r = this.patch(a, b + 1),
      t = this.patch(a + 1, b + 1);
    const blend = (key) =>
      (p[key] * (1 - x) + q[key] * x) * (1 - y) +
      (r[key] * (1 - x) + t[key] * x) * y;
    const detail = Math.sin(
      ((u * 16) / WORLD.length) * TAU * 19 + ((v * 16) / WORLD.width) * TAU * 9,
    );
    return (
      this.baseHeight(u * 16, v * 16) +
      blend("elevation") * 6 +
      detail * (0.25 + blend("ruggedness") * 1.8)
    );
  }
  score(p, preference) {
    const [m, c, f, s, d, g] = p.genes;
    const diversity =
      -p.genes.reduce(
        (sum, x) =>
          sum +
          (x / p.genes.reduce((a, b) => a + b, 0)) *
            Math.log(x / p.genes.reduce((a, b) => a + b, 0)),
        0,
      ) / Math.log(SPECIES.length);
    const mutualism =
      (Math.sqrt(m * c) +
        Math.sqrt(f * d) +
        Math.sqrt(c * d) +
        Math.sqrt(m * g)) /
      4;
    const crowding = Math.max(0, m + c + f + s - 2.5) * 0.25;
    const visual = 1 - Math.abs((f + s) * 0.32 + c * 0.25 - preference);
    const surprise = 1 / (1 + this.exposure[p.form] * 0.35);
    return clamp(
      0.22 * diversity +
        0.2 * mutualism +
        0.2 * visual +
        0.23 * surprise +
        0.1 * this.formReward[p.form] +
        0.05 * (1 - Math.abs((p.elevation + 1) * 0.5 - preference)) -
        crowding -
        Math.max(0, g - m) * 0.16 -
        Math.max(0, p.genes[6] - p.genes[7]) * 0.07,
    );
  }
  observe(u, v, novelty, dt = 1) {
    this.novelty = novelty;
    for (let i = 0; i < this.exposure.length; i++)
      this.exposure[i] *= Math.exp(-dt / 75);
    for (let a = 1; a <= 3; a++)
      for (let b = -1; b <= 1; b++) {
        const p = this.patch(Math.floor(u / 16) + a, Math.floor(v / 16) + b);
        this.exposure[p.form] += dt / 9;
        this.formReward[p.form] += (novelty - this.formReward[p.form]) * 0.025;
      }
  }
  novelForm() {
    const weights = Array.from(this.exposure, (x) => 1 / (0.2 + x)),
      sum = weights.reduce((a, b) => a + b, 0);
    let n = this.rng() * sum;
    for (let i = 0; i < weights.length; i++) {
      n -= weights[i];
      if (n <= 0) return i;
    }
    return weights.length - 1;
  }

  evolve(u, v, reward = 0.5, force = false) {
    if (this.frozen && !force) return [];
    const changed = [];
    for (let i = 0; i < (force ? 20 : 8); i++) {
      const a = Math.floor(u / 16) + 1 + Math.floor(this.rng() * 6),
        b = Math.floor(v / 16) + Math.floor(this.rng() * 7) - 3;
      const parent = this.patch(a, b),
        neighbor = this.patch(a + 1, b + (this.rng() > 0.5 ? 1 : -1));
      const candidate = {
        ...parent,
        genes: parent.genes.map((x, j) =>
          clamp(
            x * 0.82 +
              neighbor.genes[j] * 0.18 +
              (this.rng() - 0.5) * this.mutation,
            0.06,
            0.96,
          ),
        ),
        height: clamp(
          parent.height + (this.rng() - 0.5) * this.mutation,
          0.15,
          1,
        ),
        elevation: clamp(
          parent.elevation * 0.85 +
            neighbor.elevation * 0.15 +
            (this.rng() - 0.5) * this.mutation * 1.6,
          -1,
          1,
        ),
        ruggedness: clamp(
          parent.ruggedness + (this.rng() - 0.5) * this.mutation,
        ),
        hue: wrap(parent.hue + (this.rng() - 0.5) * this.mutation, 1),
      };
      if (force || this.rng() < 0.55 + (1 - this.novelty) * 0.25) {
        candidate.form = this.novelForm();
        candidate.seed = Math.floor(this.rng() * 1e9);
        candidate.motion = this.rng();
      }
      // Local resource dynamics make paired species interdependent, rather than merely decorative labels.
      const [m, c, f, s, d, g] = candidate.genes;
      candidate.genes[0] = clamp(m + 0.015 * c - 0.022 * g, 0.06, 0.96);
      candidate.genes[1] = clamp(c + 0.016 * d - 0.008 * s, 0.06, 0.96);
      candidate.genes[2] = clamp(f + 0.009 * g - 0.01 * s, 0.06, 0.96);
      candidate.genes[4] = clamp(d + 0.018 * f - 0.013 * (1 - f), 0.06, 0.96);
      candidate.genes[5] = clamp(g + 0.014 * m - 0.014 * (1 - m), 0.06, 0.96);
      candidate.genes[6] = clamp(
        candidate.genes[6] +
          0.025 * candidate.genes[7] -
          0.03 * (1 - candidate.genes[7]),
        0.06,
        0.85,
      );
      candidate.genes[7] = clamp(
        candidate.genes[7] + 0.025 * f - 0.025 * candidate.genes[6],
        0.08,
        0.96,
      );
      candidate.fitness = this.score(candidate, reward);
      parent.fitness = this.score(parent, reward);
      this.trials++;
      // Tournament selection plus a small exploration allowance avoids a static monoculture.
      if (
        candidate.fitness >= parent.fitness ||
        this.rng() < 0.12 + (1 - this.novelty) * 0.2 ||
        force ||
        (i === 0 && this.generation % 3 === 0)
      ) {
        if (parent.form !== candidate.form) this.swaps++;
        Object.assign(parent, candidate, {
          version: parent.version + 1,
          age: parent.age + 1,
        });
        changed.push(this.key(a, b));
        this.accepted++;
      }
    }
    this.generation++;
    if (changed.length) {
      const p = this.patches.get(changed[changed.length - 1]);
      this.lastEvent = `${FORMS[p.form]} emerged · ${changed.length} patches reimagined`;
    }
    return changed;
  }
  population(u, v) {
    const totals = Array(SPECIES.length).fill(0);
    let fitness = 0;
    for (let a = 0; a < 5; a++)
      for (let b = -2; b <= 2; b++) {
        const p = this.patch(Math.floor(u / 16) + a, Math.floor(v / 16) + b);
        p.genes.forEach((g, i) => (totals[i] += g));
        fitness += this.score(p, 0.5);
      }
    const sum = totals.reduce((a, b) => a + b, 0);
    return { shares: totals.map((x) => x / sum), fitness: fitness / 25 };
  }
}
// Deliberately a compact proxy, not the FlyEM connectome. 892 visual columns feed
// leaky spiking units; only a small mushroom-body-like readout has plastic weights.
export class FlyBrain {
  constructor(seed = 99) {
    const rng = random(seed);
    this.voltage = new Float32Array(892);
    this.previous = new Float32Array(892);
    this.weights = Float32Array.from({ length: 892 }, () => 0.65 + rng() * 0.3);
    this.spikes = new Uint8Array(892);
    this.dopamine = 0.5;
    this.left = 0.5;
    this.right = 0.5;
    this.rate = 0;
    this.steer = 0;
    this.history = [];
    this.spikeHistory = [];
    this.adaptation = 0;
    this.familiarity = new Float32Array(32);
    this.novelty = 1;
    this.initialized = false;
  }
  step(pixels, dt = 0.1) {
    let left = 0,
      right = 0,
      countL = 0,
      countR = 0,
      spikeCount = 0,
      novelty = 0;
    for (let i = 0; i < 892; i++) {
      const x = i % 30,
        y = Math.floor(i / 30),
        j = (y * 30 + x) * 4;
      const r = pixels[j] / 255,
        g = pixels[j + 1] / 255,
        b = pixels[j + 2] / 255;
      const light = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const change = this.initialized ? Math.abs(light - this.previous[i]) : 0;
      novelty += change;
      const contrast = Math.max(r, g, b) - Math.min(r, g, b);
      const bin = Math.min(
        31,
        Math.floor(r * 3) * 9 + Math.floor(g * 3) * 3 + Math.floor(b * 3),
      );
      const surprise = 1 / Math.sqrt(1 + this.familiarity[bin] * 5);
      const input = clamp(
        (light * 0.28 + contrast * 0.3) * (0.3 + surprise * 0.7) + change * 2.6,
      );
      this.familiarity[bin] += dt / 892;
      novelty += surprise * 0.025;
      this.voltage[i] =
        this.voltage[i] * Math.exp(-dt / 0.22) + input * dt * 11.5;
      this.spikes[i] = this.voltage[i] > 0.9 ? 1 : 0;
      if (this.spikes[i]) {
        this.voltage[i] = 0;
        spikeCount++;
      }
      const reward = input * this.weights[i];
      if (x < 15) {
        left += reward;
        countL++;
      } else {
        right += reward;
        countR++;
      }
      // Dopamine-gated depression is isolated to these readout weights.
      this.weights[i] = clamp(
        this.weights[i] +
          dt * 0.012 * (0.85 - this.weights[i]) -
          dt * 0.025 * this.dopamine * this.spikes[i],
        0.3,
        1,
      );
      this.previous[i] = light;
    }
    for (let i = 0; i < 32; i++) this.familiarity[i] *= Math.exp(-dt / 45);
    this.novelty +=
      (clamp((novelty / 892) * 14) - this.novelty) * (1 - Math.exp(-dt / 1.4));
    this.initialized = true;
    this.left = left / countL;
    this.right = right / countR;
    const target = clamp((this.left + this.right) * 0.65 + this.novelty * 0.4);
    this.dopamine += (target - this.dopamine) * 0.1;
    this.rate += (spikeCount / dt - this.rate) * 0.18;
    this.steer +=
      (clamp((this.right - this.left) * 14, -1, 1) - this.steer) * 0.12;
    this.history.push(this.dopamine);
    this.spikeHistory.push(spikeCount / 892);
    if (this.history.length > 100) {
      this.history.shift();
      this.spikeHistory.shift();
    }
  }
}
