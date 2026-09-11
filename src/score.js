// Original composition: Wandering Light. MIDI note numbers, not sampled audio.
export const SCORE = { title: "Wandering Light", bpm: 75, beats: 128 };
// D-minor pedal harmony keeps the half-time calm score related to the firing groove.
const colors = [[50, 57, 60, 64, 69], [50, 57, 60, 65, 69],
  [50, 57, 62, 65, 69], [50, 57, 60, 64, 67]];
const chords = Array.from({ length: 16 }, (_, bar) => colors[Math.floor(bar / 2) % 4]);
export function scoreEvents() {
  const events = [];
  chords.forEach((chord, bar) => {
    const beat = bar * 8;
    chord.forEach((note) =>
      events.push({ beat, note, duration: 7.8, velocity: 44, part: "pad" }));
    [0, 1, 1.5, 2, 3, 4, 5, 5.5, 6, 7].forEach((offset, i) =>
      events.push({ beat: beat + offset, note: 38 + (i === 6 ? 12 : 0),
        duration: offset % 1 ? 0.2 : 0.42, velocity: offset % 1 ? 33 : 46, part: "bass" }));
    [0, 2, 1, 2].forEach((degree, i) =>
      events.push({ beat: beat + [0.5, 2.5, 4.5, 6.5][i],
        note: chord[degree] + 12, duration: 0.45, velocity: 29 + (i % 2) * 5, part: "arp" }));
    // A sparse, independently composed answering phrase, with room for the view.
    if (bar % 2 === 1)
      [2, 4, 1].forEach((degree, i) =>
        events.push({
          beat: beat + [1, 3.5, 6][i],
          note: chord[degree] + 12,
          duration: 2.2,
          velocity: 32,
          part: "bell",
        }),
      );
  });
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
