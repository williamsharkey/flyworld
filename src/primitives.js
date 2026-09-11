/** Distinct voxel phenotypes. Every patch can inherit and replace its entire grammar. */
export function buildPrimitive(form, put, v, h, u, p, rng, setRoot) {
  const palette = [
    "#e4b870",
    "#bda2cc",
    "#91c9c5",
    "#dc967b",
    "#b7bea3",
    "#adc7a0",
    "#d5b67a",
    "#dab9d5",
  ];
  const c = palette[Math.floor(p.hue * palette.length) % palette.length],
    height = 3 + p.height * 5;
  setRoot([v, h, u, [5, 10].includes(form) ? 3 : 1]);
  if (form === 2) {
    // Crystal fans
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2,
        s = 0.6 + rng() * 0.65,
        y = 2 + rng() * height;
      put(v + Math.cos(a) * 1.7, h + y / 2, u + Math.sin(a) * 1.7, s, y, s, c);
      put(
        v + Math.cos(a) * 1.7,
        h + y + 0.25,
        u + Math.sin(a) * 1.7,
        s * 0.65,
        0.5,
        s * 0.65,
        "#e4e9cc",
      );
    }
  } else if (form === 3) {
    // Giant mushrooms
    put(v, h + height * 0.35, u, 0.75, height * 0.7, 0.75, "#ded1b0");
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++)
        if (x * x + z * z < 6) {
          put(v + x, h + height * 0.7, u + z, 0.98, 0.7, 0.98, c);
          if ((x + z) % 3 === 0)
            put(
              v + x,
              h + height * 0.7 + 0.4,
              u + z,
              0.35,
              0.14,
              0.35,
              "#f0dfbe",
            );
        }
    put(v, h + height * 0.7 + 0.6, u, 2.8, 0.6, 2.8, c);
  } else if (form === 4) {
    // Stone arch
    for (const side of [-1, 1]) {
      put(v + side * 2.5, h + height / 2, u, 1.2, height, 1.5, "#b9b09b");
      put(v + side * 1.7, h + height - 0.2, u, 1.5, 1.1, 1.5, "#d1c4a6");
    }
    put(v, h + height + 0.25, u, 3, 1, 1.5, "#d1c4a6");
  } else if (form === 5) {
    // Floating islands with hanging roots
    const y = h + 5 + height * 0.4;
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++)
        if (x * x + z * z < 6) {
          put(v + x, y, u + z, 0.99, 0.8, 0.99, "#a5b88d");
          const drop = 0.7 + rng() * 2;
          put(v + x, y - drop / 2 - 0.4, u + z, 0.75, drop, 0.75, "#827c68");
        }
    put(v, y + 1.3, u, 0.35, 1.8, 0.35, "#9f7d75");
    put(v, y + 2.2, u, 2, 0.6, 2, c);
  } else if (form === 6) {
    // Double helix towers
    for (let i = 0; i < 18; i++)
      for (const phase of [0, Math.PI]) {
        const a = i * 0.55 + phase;
        put(
          v + Math.cos(a) * 1.4,
          h + i * 0.4 + 0.3,
          u + Math.sin(a) * 1.4,
          0.75,
          0.6,
          0.75,
          c,
        );
      }
  } else if (form === 7) {
    // Giant flowers
    for (let j = 0; j < 5; j++) {
      const x = v + (rng() - 0.5) * 5,
        z = u + (rng() - 0.5) * 5,
        y = h + 1.5 + rng() * 3;
      put(x, (h + y) / 2, z, 0.22, y - h, 0.22, "#839966");
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        put(x + Math.cos(a) * 0.7, y, z + Math.sin(a) * 0.7, 0.8, 0.3, 0.8, c);
      }
      put(x, y + 0.16, z, 0.6, 0.35, 0.6, "#f0d58e");
    }
  } else if (form === 8) {
    // Basalt cathedral
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2,
        y = 2 + rng() * height * 1.5;
      put(
        v + Math.cos(a) * 2,
        h + y / 2,
        u + Math.sin(a) * 2,
        0.9,
        y,
        0.9,
        i % 2 ? "#778c85" : "#91a29a",
      );
      put(
        v + Math.cos(a) * 2,
        h + y + 0.15,
        u + Math.sin(a) * 2,
        0.9,
        0.3,
        0.9,
        c,
      );
    }
  } else if (form === 9) {
    // Reeds / cattails
    for (let i = 0; i < 16; i++) {
      const x = v + (rng() - 0.5) * 5,
        z = u + (rng() - 0.5) * 5,
        y = 1 + rng() * 4;
      put(x, h + y / 2, z, 0.16, y, 0.16, "#91a679");
      put(x, h + y - 0.1, z, 0.33, 0.65, 0.33, "#c5a579");
    }
  } else if (form === 10) {
    // Floating voxel rings
    const y = h + height * 0.7;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      put(v + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, u, 0.63, 0.63, 0.63, c);
    }
    put(v, y, u, 0.7, 0.7, 0.7, "#f2db9a");
  } else if (form === 11) {
    // Branching ruins
    for (let i = 0; i < 4; i++) {
      put(v + i * 0.7, h + i * 1.7 + 0.8, u, 0.8, 1.7, 0.8, "#baa695");
      put(v + i * 0.7, h + i * 1.7 + 1.7, u, 3.3, 0.7, 0.8, c);
      put(v + i * 0.7 + 1.4, h + i * 1.7 + 2.3, u, 0.6, 1.1, 0.6, c);
    }
  }
}
