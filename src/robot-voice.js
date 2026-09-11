// A small source/filter phoneme synthesizer: pitched glottal pulses, three
// moving formants, and noise consonants. No speech service, samples or downloads.
export const CHANT = "tear da club up, tear da fucking club up";
export const CHANT_BEATS = 4;
export const VOICE_VOLUME = 0.7;
// Original eight-bar verse. Each token is an eighth-note syllable, not TTS.
export const VERSE_LINES = [
  ["Big booty fruit flies, shake that rind", "big boo ty fruit flies shake that rind"],
  ["Wash that ass, leave the funk behind", "wash that ass leave the funk be hind"],
  ["Ripe peach bass, make the whole swarm jump", "ripe peach bass make the whole swarm jump"],
  ["Six legs low, let that thorax bump", "six legs low let that thor ax bump"],
  ["Don't get mad if I wanna fuck", "don't get mad if i wan na fuck"],
  ["Say hell yes, or it's no such luck", "say hell yes or it's no such luck"],
  ["Soap up wings, let the water run", "soap up wings let the wa ter run"],
  ["Back to bass till the break of sun", "back to bass till the break of sun"],
];
export const VERSE_BARS = VERSE_LINES.map(([text, syllables]) => ({
  text,
  words: syllables.split(" ").map((word, i) => ({
    beat: i * 0.5, word, note: [50, 50, 48, 50, 50, 48, 45, 45][i],
  })),
}));
export const CHANT_WORDS = [
  { beat: 0, word: "tear", note: 50 },
  { beat: 0.5, word: "da", note: 50 },
  { beat: 1, word: "club", note: 48 },
  { beat: 1.5, word: "up", note: 45 },
  { beat: 2, word: "tear", note: 50 },
  { beat: 2.25, word: "da", note: 50 },
  { beat: 2.5, word: "fuck", note: 50 },
  { beat: 2.75, word: "ing", note: 48 },
  { beat: 3, word: "club", note: 48 },
  { beat: 3.5, word: "up", note: 45 },
];
// Two hook bars, eight verse bars, two hook bars; restart with each firing session.
export function vocalBar(loop) {
  const bar = loop % 12;
  return bar >= 2 && bar < 10
    ? VERSE_BARS[bar - 2]
    : { text: CHANT, words: CHANT_WORDS };
}
const vowels = {
  air: [600, 1750, 2450],
  r: [350, 1150, 1650],
  uh: [650, 1200, 2500],
  l: [350, 2100, 2900],
  ih: [400, 2000, 2600],
  ng: [300, 1600, 2500],
  ee: [300, 2300, 3000], oo: [300, 850, 2250],
  oh: [450, 850, 2400], ah: [750, 1200, 2500],
  ae: [700, 1800, 2600], eh: [550, 1900, 2600],
  aw: [550, 900, 2400], m: [250, 1000, 2100], n: [300, 1700, 2500],
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
const versePhonemes = {
  big: "b ih g", boo: "b oo", ty: "t ee", fruit: "f r oo t",
  flies: "f l ah ee z", shake: "sh eh ee k", that: "th ae t", rind: "r ah ee n d",
  wash: "w aw sh", ass: "ae s", leave: "l ee v", the: "th uh",
  funk: "f uh ng k", be: "b ee", hind: "h ah ee n d",
  ripe: "r ah ee p", peach: "p ee ch", bass: "b eh ee s", make: "m eh ee k",
  whole: "h oh l", swarm: "s w aw r m", jump: "j uh m p",
  six: "s ih k s", legs: "l eh g z", low: "l oh oo", let: "l eh t",
  thor: "th aw r", ax: "ae k s", bump: "b uh m p",
  "don't": "d oh n t", get: "g eh t", mad: "m ae d", if: "ih f", i: "ah ee",
  wan: "w ah n", na: "n uh", say: "s eh ee", hell: "h eh l", yes: "y eh s",
  or: "aw r", "it's": "ih t s", no: "n oh", such: "s uh ch", luck: "l uh k",
  soap: "s oh oo p", wings: "w ih ng z", wa: "w aw", ter: "t uh r",
  run: "r uh n", back: "b ae k", to: "t oo", till: "t ih l",
  break: "b r eh ee k", of: "uh v", sun: "s uh n",
};
for (const [word, phones] of Object.entries(versePhonemes)) {
  const parts = phones.split(" ");
  const weights = parts.map(p => vowels[p] ? 1 : 0.32);
  const total = weights.reduce((a, b) => a + b, 0);
  syllables[word] = parts.map((p, i) => [p, weights[i] / total]);
}
export const VOCABULARY = Object.freeze(Object.keys(syllables));
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
    this.gain.gain.value = 1.4 * VOICE_VOLUME;
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
    this.part(word, time, duration, note - 12, 0.72, 0.92);
    this.part(word, time, duration, note + 12, 0.52, 1.08);
    this.words++;
  }
  part(word, time, duration, note, level, formants) {
    const ctx = this.ctx,
      f0 = 440 * 2 ** ((note - 69) / 12);
    let at = time;
    for (const [phoneme, fraction] of syllables[word]) {
      const length = duration * fraction,
        env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(
        level,
        at + Math.min(0.004, length * 0.15),
      );
      env.gain.setValueAtTime(level, at + length * 0.8);
      env.gain.linearRampToValueAtTime(0, at + length);
      env.connect(this.gain);
      const source = vowels[phoneme]
          ? ctx.createOscillator()
          : ctx.createBufferSource(),
        nodes = [];
      if (vowels[phoneme]) {
        source.type = "sawtooth";
        source.frequency.setValueAtTime(f0, at);

        vowels[phoneme].forEach((frequency, i) => {
          const filter = ctx.createBiquadFilter(),
            gain = ctx.createGain();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(frequency * formants, at);
          filter.frequency.linearRampToValueAtTime(
            frequency * formants * 0.98,
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
          f: 6000, s: 6500, z: 4500, sh: 3500, ch: 3900,
          th: 5200, v: 2800, g: 1200, h: 1800, w: 600, y: 2100, j: 2600,
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
  }
  get rms() {
    const data = new Float32Array(512);
    this.analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
  }
}
