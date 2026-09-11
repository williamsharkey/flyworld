import lyrics from "./lyrics.json" with { type: "json" };

export const CHANT_BEATS = 8;
export const SONG_SLOTS = 18;
export const SONG_FAMILIES = ["Wandering Light", "Neon Monsoon"];
export { lyrics };
const byId = new Map(lyrics.map(line => [line.id, line]));

// Sixteen-bar verse, four-bar answer, eight-bar hook, then bridge and turnaround.
// Chapter selection persists across firing sessions instead of repeating the intro.
export function songSlot(index, family = 0, firstChapter = 0) {
  const slot = index % SONG_SLOTS;
  const chapter = (firstChapter + Math.floor(index / SONG_SLOTS)) % 3;
  let section, kind, lineIndex, energy;
  if (slot < 8) {
    section = "verse"; kind = "verse"; lineIndex = chapter * 8 + slot; energy = .8;
  } else if (slot < 10) {
    section = "answer"; energy = .94;
  } else if (slot < 14) {
    section = "hook"; kind = "hook"; lineIndex = slot - 10; energy = 1;
  } else if (slot < 16) {
    section = "bridge"; kind = "bridge"; lineIndex = slot - 14; energy = .48;
  } else {
    section = "turnaround"; energy = .65 + (slot - 16) * .2;
  }
  const line = kind ? byId.get(`${family}-${kind}-${String(lineIndex).padStart(2, "0")}`) : null;
  return { section, chapter, energy, line, family };
}
