import { MusicEvolution } from "./music-evolution.js";
import { opusAt, modalNote } from "./opus.js";
export const SCORE = { title: "Wandering Light / Neon Monsoon", bpm: 75, beats: 128 };
/** Generate a bounded window; persistent state carries phrases across window edges. */
export function scoreEvents(evolution = new MusicEvolution(), startSeconds = 0) {
  const events = [], pads = evolution.padNext;
  for (let beat = 0; beat < SCORE.beats; beat += 0.5) {
    evolution.advance(0.4);
    const phase = opusAt(startSeconds + beat * 0.8), second = evolution.chance(phase.familyMix);
    const pitch = note => modalNote(note, phase, evolution.rng);
    // Each pad voice renews independently, overlapping its predecessor's release.
    pads.forEach((next, i) => {
      if (beat < next) return;
      const duration = 5.5 + evolution.rng() * 3;
      const note = pitch([50, 57, evolution.choose(60, 62), evolution.choose(64, 69)][i]);
      events.push({ beat, note, duration, velocity: 39, part: "pad" });
      pads[i] = beat + duration;
    });
    const anchor = beat % 1 === 0;
    if (evolution.chance(anchor ? 0.91 : 0.12 + evolution.density * 0.3))
      events.push({ beat, note: pitch(38 + (!anchor && second ? 7 : 0)),
        duration: anchor ? 0.42 : 0.2, velocity: anchor ? 46 : 32, part: "bass" });
    if (!anchor && evolution.chance(0.25 + evolution.density * 0.5)) {
      const motif = second ? [0, 7, 12, 9, 7, 4, 2] : [0, 3, 7, 5, 3];
      const degree = motif[Math.floor(beat) % motif.length];
      events.push({ beat, note: pitch(62 + degree), duration: second ? 0.7 : 0.45,
        velocity: 30 + Math.floor(evolution.rng() * 10), part: second ? "bell" : "arp",
        glide: second && evolution.chance(0.32) });
    }
    if (evolution.chance(0.025 + phase.familyMix * 0.03))
      events.push({ beat: beat + 0.25, note: pitch(74 + evolution.choose(0, 7)),
        duration: 1.8, velocity: 28, part: "bell" });
  }
  evolution.padNext = pads.map(t => t - SCORE.beats);
  return events.sort((a, b) => a.beat - b.beat);
}
const vlq = (value) => {
  const bytes = [value & 127];
  while ((value >>>= 7)) bytes.unshift((value & 127) | 128);
  return bytes;
};
export function makeMidi() {
  const data = [],
    write32 = (n) =>
      data.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const track = (bytes) => {
    data.push(77, 84, 114, 107);
    write32(bytes.length);
    data.push(...bytes);
  };
  data.push(77, 84, 104, 100, 0, 0, 0, 6, 0, 1, 0, 5, 1, 224);
  const tempo = Math.round(60e6 / SCORE.bpm);
  track([
    0,
    255,
    81,
    3,
    (tempo >>> 16) & 255,
    (tempo >>> 8) & 255,
    tempo & 255,
    0,
    255,
    88,
    4,
    4,
    2,
    24,
    8,
    0,
    255,
    47,
    0,
  ]);
  ["pad", "bass", "arp", "bell"].forEach((part, channel) => {
    const messages = [];
    scoreEvents()
      .filter((e) => e.part === part)
      .forEach((e) => {
        messages.push({
          tick: Math.round(e.beat * 480),
          bytes: [144 + channel, e.note, e.velocity],
        });
        messages.push({
          tick: Math.round((e.beat + e.duration) * 480),
          bytes: [128 + channel, e.note, 0],
        });
      });
    messages.sort((a, b) => a.tick - b.tick || a.bytes[0] - b.bytes[0]);
    const bytes = [0, 192 + channel, [89, 38, 81, 10][channel]];
    let last = 0;
    for (const event of messages) {
      bytes.push(...vlq(event.tick - last), ...event.bytes);
      last = event.tick;
    }
    bytes.push(...vlq(Math.max(0, SCORE.beats * 480 - last)), 255, 47, 0);
    track(bytes);
  });
  return new Uint8Array(data);
}
