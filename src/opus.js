// Equal-tempered pitch palettes inspired by the album's ten named ragas.
// These are compositional constraints, not a model of classical raga grammar.
export const MODES = [
  ["Bhairav", [0, 1, 4, 5, 7, 8, 11]],
  ["Lalit", [0, 1, 4, 5, 6, 8, 11]],
  ["Bhupali", [0, 2, 4, 7, 9]],
  ["Megh Malhar", [0, 2, 5, 7, 10]],
  ["Yaman", [0, 2, 4, 6, 7, 9, 11]],
  ["Kalavati", [0, 4, 7, 9, 10]],
  ["Madhuvanti", [0, 2, 3, 6, 7, 9, 11]],
  ["Todi", [0, 1, 3, 6, 7, 8, 11]],
  ["Malkauns", [0, 3, 5, 8, 10]],
  ["Bairagi", [0, 1, 5, 7, 10]],
];
export const MOVEMENT_SECONDS = 96;
export const OPUS_SECONDS = MOVEMENT_SECONDS * MODES.length;
export const SONG_FAMILIES = ["Wandering Light", "Neon Monsoon"];
export function opusAt(seconds) {
  const elapsed = Math.max(0, seconds),
    index = Math.floor(elapsed / MOVEMENT_SECONDS) % MODES.length,
    local = elapsed % MOVEMENT_SECONDS,
    fade = Math.max(0, (local - 72) / 24);
  return {
    index, mode: MODES[index][0], nextMode: MODES[(index + 1) % MODES.length][0],
    blend: fade * fade * (3 - 2 * fade),
    familyMix: 0.5 - 0.5 * Math.cos(local / MOVEMENT_SECONDS * Math.PI * 2),
    progress: (elapsed % OPUS_SECONDS) / OPUS_SECONDS,
  };
}
export function modalNote(note, phase, rng) {
  const index = rng() < phase.blend ? (phase.index + 1) % MODES.length : phase.index;
  const scale = MODES[index][1];
  let best = note, distance = Infinity;
  for (let candidate = Math.floor(note) - 6; candidate <= Math.ceil(note) + 6; candidate++) {
    if (scale.includes(((candidate - 50) % 12 + 12) % 12) && Math.abs(note - candidate) < distance) {
      best = candidate; distance = Math.abs(note - candidate);
    }
  }
  return best;
}
