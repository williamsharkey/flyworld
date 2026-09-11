// A small source/filter phoneme synthesizer: pitched glottal pulses, three
// moving formants, and noise consonants. No speech service, samples or downloads.
export const CHANT = "tear da club up, tear da fucking club up";
export const CHANT_WORDS = [
  { beat: 0, word: "tear", note: 50 },
  { beat: 0.75, word: "da", note: 50 },
  { beat: 1.5, word: "club", note: 48 },
  { beat: 2.25, word: "up", note: 45 },
  { beat: 3.5, word: "tear", note: 50 },
  { beat: 4.25, word: "da", note: 50 },
  { beat: 5, word: "fuck", note: 50 },
  { beat: 5.5, word: "ing", note: 48 },
  { beat: 6.25, word: "club", note: 48 },
  { beat: 7, word: "up", note: 45 },
];
const vowels = {
  air: [600, 1750, 2450],
  r: [350, 1150, 1650],
  uh: [650, 1200, 2500],
  l: [350, 2100, 2900],
  ih: [400, 2000, 2600],
  ng: [300, 1600, 2500],
};
const syllables = {
  tear: [
    ["t", 0.12],
    ["air", 0.62],
    ["r", 0.26],
  ],
  da: [
    ["d", 0.1],
    ["uh", 0.9],
  ],
  club: [
    ["k", 0.1],
    ["l", 0.16],
    ["uh", 0.63],
    ["b", 0.11],
  ],
  up: [
    ["uh", 0.8],
    ["p", 0.2],
  ],
  fuck: [
    ["f", 0.17],
    ["uh", 0.66],
    ["k", 0.17],
  ],
  ing: [
    ["ih", 0.7],
    ["ng", 0.3],
  ],
};
export class RobotVoice {
  constructor(ctx, destination, noise) {
    this.ctx = ctx;
    this.destination = destination;
    this.noise = noise;
    this.words = 0;
    this.nodes = new Set();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.gain = ctx.createGain();
    this.gain.gain.value = 1.4;
    this.gain.connect(destination);
    this.gain.connect(this.analyser);
  }
  stop() {
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {}
    }
    this.nodes.clear();
  }
  word(word, time, duration, note) {
    const ctx = this.ctx,
      f0 = 440 * 2 ** ((note - 69) / 12);
    let at = time;
    for (const [phoneme, fraction] of syllables[word]) {
      const length = duration * fraction,
        env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(1, at + Math.min(0.008, length * 0.2));
      env.gain.setValueAtTime(1, at + length * 0.72);
      env.gain.linearRampToValueAtTime(0, at + length);
      env.connect(this.gain);
      const source = vowels[phoneme]
          ? ctx.createOscillator()
          : ctx.createBufferSource(),
        nodes = [];
      if (vowels[phoneme]) {
        source.type = "sawtooth";
        source.frequency.setValueAtTime(f0, at);
        source.frequency.linearRampToValueAtTime(f0 * 0.97, at + length);
        vowels[phoneme].forEach((frequency, i) => {
          const filter = ctx.createBiquadFilter(),
            gain = ctx.createGain();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(frequency, at);
          filter.frequency.linearRampToValueAtTime(
            frequency * 0.95,
            at + length,
          );
          filter.Q.value = frequency / [90, 120, 180][i];
          gain.gain.value = [2.8, 1.7, 0.9][i];
          source.connect(filter).connect(gain).connect(env);
          nodes.push(filter, gain);
        });
      } else {
        source.buffer = this.noise;
        const filter = ctx.createBiquadFilter(),
          gain = ctx.createGain();
        filter.type = "bandpass";
        filter.frequency.value = {
          t: 5000,
          d: 1600,
          k: 2700,
          b: 700,
          p: 1000,
          f: 6000,
        }[phoneme];
        filter.Q.value = 0.7;
        gain.gain.value = phoneme === "f" ? 0.18 : 0.28;
        source.connect(filter).connect(gain).connect(env);
        nodes.push(filter, gain);
      }
      this.nodes.add(source);
      source.start(at);
      source.stop(at + length + 0.01);
      source.onended = () => {
        this.nodes.delete(source);
        source.disconnect();
        env.disconnect();
        nodes.forEach((n) => n.disconnect());
      };
      at += length;
    }
    this.words++;
  }
  get rms() {
    const data = new Float32Array(512);
    this.analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
  }
}
