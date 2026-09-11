// A small source/filter phoneme synthesizer: pitched glottal pulses, three
// moving formants, and noise consonants. No speech service, samples or downloads.
export const CHANT = "tear da club up, tear da fucking club up";
export const CHANT_BEATS = 8;
export const VOICE_VOLUME = 0.7;
// Twenty-four original lines, each spread across two bars with breathing room.
export const VERSE_LINES = [
  ["Big booty fruit flies, shake that rind", "big boo ty fruit flies shake that rind"],
  ["Wash that ass, leave the funk behind", "wash that ass leave the funk be hind"],
  ["Ripe peach bass, make the whole swarm jump", "ripe peach bass make the whole swarm jump"],
  ["Six legs low, let that thorax bump", "six legs low let that thor ax bump"],
  ["Don't get mad if I wanna fuck", "don't get mad if i wan na fuck"],
  ["Say hell yes, or it's no such luck", "say hell yes or it's no such luck"],
  ["Soap up wings, let the water run", "soap up wings let the wa ter run"],
  ["Back to bass till the break of sun", "back to bass till the break of sun"],
  ["Chrome green wings with a fresh-cut shine", "chrome green wings with a fresh cut shine"],
  ["Sweet juice drips from a late-night grind", "sweet juice drips from a late night grind"],
  ["Trash-can queens on a moonlit ride", "trash can queens on a moon lit ride"],
  ["Bad-ass bugs with the bass inside", "bad ass bugs with the bass in side"],
  ["Turn that peach till the whole tree shakes", "turn that peach till the whole tree shakes"],
  ["Drop down low when the kick drum breaks", "drop down low when the kick drum breaks"],
  ["Wet wings dry in the hot pink light", "wet wings dry in the hot pink light"],
  ["Fresh as fuck on a late-night flight", "fresh as fuck on a late night flight"],
  ["Big red eyes see the whole room spin", "big red eyes see the whole room spin"],
  ["One more rinse then we all go in", "one more rinse then we all go in"],
  ["Fruit bowl freaks with a six-leg strut", "fruit bowl freaks with a six leg strut"],
  ["Shake that peach with your big round butt", "shake that peach with your big round butt"],
  ["Bass so thick make the glass jars hum", "bass so thick make the glass jars hum"],
  ["Fly that ass where the wild bugs come", "fly that ass where the wild bugs come"],
  ["Clean wings up and the lights down low", "clean wings up and the lights down low"],
  ["Whole swarm hot when the night winds blow", "whole swarm hot when the night winds blow"],
];
export const VERSE_BARS = VERSE_LINES.map(([text, syllables]) => ({
  text,
  words: syllables.split(" ").map((word, i) => ({
    beat: [0, 0.75, 1.5, 2.5, 4, 4.75, 5.5, 6.5][i], word, note: [50, 50, 48, 50, 50, 48, 45, 45][i],
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
// Four verse lines, then one hook; six distinct groups before the cycle repeats.
export function vocalBar(loop) {
  const slot = loop % 30;
  return slot % 5 === 4
    ? { text: CHANT, words: CHANT_WORDS.map(w => ({ ...w, beat: w.beat * 2 })) }
    : VERSE_BARS[Math.floor(slot / 5) * 4 + slot % 5];
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
  chrome: "k r oh m", green: "g r ee n", with: "w ih th", a: "uh",
  fresh: "f r eh sh", cut: "k uh t", shine: "sh ah ee n",
  sweet: "s w ee t", juice: "j oo s", drips: "d r ih p s", from: "f r uh m",
  late: "l eh ee t", night: "n ah ee t", grind: "g r ah ee n d",
  trash: "t r ae sh", can: "k ae n", queens: "k w ee n z", on: "ah n",
  moon: "m oo n", lit: "l ih t", ride: "r ah ee d", bad: "b ae d",
  bugs: "b uh g z", in: "ih n", side: "s ah ee d", turn: "t uh r n",
  tree: "t r ee", shakes: "sh eh ee k s", drop: "d r ah p", down: "d ah oo n",
  when: "w eh n", kick: "k ih k", drum: "d r uh m", breaks: "b r eh ee k s",
  wet: "w eh t", dry: "d r ah ee", hot: "h ah t", pink: "p ih ng k", light: "l ah ee t",
  as: "ae z", flight: "f l ah ee t", red: "r eh d", eyes: "ah ee z",
  see: "s ee", room: "r oo m", spin: "s p ih n", one: "w uh n", more: "m aw r",
  rinse: "r ih n s", then: "th eh n", we: "w ee", all: "aw l", go: "g oh",
  bowl: "b oh l", freaks: "f r ee k s", leg: "l eh g", strut: "s t r uh t",
  your: "y aw r", round: "r ah oo n d", butt: "b uh t", so: "s oh",
  thick: "th ih k", glass: "g l ae s", jars: "j ah r z", hum: "h uh m",
  fly: "f l ah ee", where: "w air", wild: "w ah ee l d", come: "k uh m",
  clean: "k l ee n", and: "ae n d", lights: "l ah ee t s", winds: "w ih n d z", blow: "b l oh",

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
