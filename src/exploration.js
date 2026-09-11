import { WORLD, wrap, delta } from "./simulation.js";

/** Count entries into 4×4 world cells, independently of frame rate or dwell time. */
export class Exploration {
  constructor(cellSize = 4) {
    this.cellSize = cellSize;
    this.columns = WORLD.length / cellSize;
    this.rows = WORLD.width / cellSize;
    this.reset();
  }
  reset() {
    this.visits = new Uint16Array(this.columns * this.rows);
    this.unique = 0;
    this.entries = 0;
    this.previous = null;
    this.lastCell = -1;
  }
  index(u, v) {
    return (
      Math.floor(wrap(v, WORLD.width) / this.cellSize) * this.columns +
      Math.floor(wrap(u, WORLD.length) / this.cellSize)
    );
  }
  record(u, v) {
    const start = this.previous || { u, v };
    const du = delta(u, start.u, WORLD.length),
      dv = delta(v, start.v, WORLD.width);
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(du, dv) / (this.cellSize / 2)),
    );
    for (let i = 1; i <= steps; i++) {
      const index = this.index(
        start.u + (du * i) / steps,
        start.v + (dv * i) / steps,
      );
      if (index === this.lastCell) continue;
      if (!this.visits[index]) this.unique++;
      this.visits[index] = Math.min(65535, this.visits[index] + 1);
      this.entries++;
      this.lastCell = index;
    }
    this.previous = { u, v };
  }
  get coverage() {
    return this.unique / this.visits.length;
  }
  opacity(index) {
    return this.visits[index]
      ? Math.min(0.94, 0.3 + Math.log2(this.visits[index]) * 0.16)
      : 0;
  }
}

export class TrailMap {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.buffer = document.createElement("canvas");
    this.buffer.width = world.exploration.columns;
    this.buffer.height = world.exploration.rows;
    this.ctx = this.buffer.getContext("2d");
    this.image = this.ctx.createImageData(
      this.buffer.width,
      this.buffer.height,
    );
  }
  draw() {
    const world = this.world,
      trail = world.exploration;
    const pixels = this.image.data;
    for (let i = 0; i < trail.visits.length; i++) {
      const alpha = trail.opacity(i),
        j = i * 4;
      pixels[j] = 184;
      pixels[j + 1] = 210;
      pixels[j + 2] = 148;
      pixels[j + 3] = Math.round(alpha * 255);
    }
    this.ctx.putImageData(this.image, 0, 0);
    const ctx = this.canvas.getContext("2d"),
      w = this.canvas.width,
      h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#15271eb3";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#c3d6aa13";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += w / 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += h / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, 0, 0, w, h);
    // Toroidal copies avoid a clipped current-position marker at either seam.
    const x = (world.u / WORLD.length) * w,
      y = (world.v / WORLD.width) * h;
    ctx.strokeStyle = "#e4cfab88";
    ctx.beginPath();
    ctx.arc((12 / WORLD.length) * w, 0.5 * h, 4, 0, Math.PI * 2);
    ctx.stroke();
    for (const ox of [-w, 0, w])
      for (const oy of [-h, 0, h]) {
        ctx.shadowColor = "#f1bb83";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#f1bb83";
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.shadowBlur = 0;
  }
}
