export const hudMarkup = `<aside id="neural-hud" aria-label="Neural activity">
  <div class="hud-images"><div><canvas id="neural" width="180" height="180" aria-label="Visual neuron activations"></canvas><span>ACTIVITY</span></div>
  <div class="eye-wrap"><canvas id="eye" width="30" height="30" aria-label="Fly eye view"></canvas><div class="eye-quadrants">${["↖", "↗", "↙", "↘"].map((label, i) => `<span id="interest-${i}" aria-label="${["Upper left", "Upper right", "Lower left", "Lower right"][i]} activation">${label} <b>0%</b></span>`).join("")}</div></div></div>
  <div class="hud-metrics"><div><span>SPIKES/S</span><output id="spike-rate">0</output></div><div><span>DA</span><output id="dopamine">0.00</output></div><div><span>NOVELTY</span><output id="novelty">0%</output></div></div>
  <canvas id="activity-history" width="480" height="64" aria-label="Spike and dopamine history"></canvas>
  <div class="attention-view"><span>↑ <output id="attention-up">0%</output></span><div><span>← <output id="attention-left">0%</output></span><div class="attention-cross"><i id="attention-dot"></i></div><span><output id="attention-right">0%</output> →</span></div><span>↓ <output id="attention-down">0%</output></span></div>
  <canvas id="touch-activity" width="264" height="8" aria-label="Tactile neuron activations"></canvas>
</aside>`;
export class NeuralHud {
  constructor() {
    this.neural = document.getElementById("neural").getContext("2d");
    this.eye = document.getElementById("eye").getContext("2d");
    this.pixels = this.eye.createImageData(30, 30);
    this.history = document.getElementById("activity-history").getContext("2d");
    this.touch = document.getElementById("touch-activity").getContext("2d");
  }
  see(pixels) {
    for (let y = 0; y < 30; y++)
      this.pixels.data.set(pixels.subarray(y * 120, (y + 1) * 120), (29 - y) * 120);
    this.eye.putImageData(this.pixels, 0, 0);
  }
  draw(brain) {
    const set = (id, value) => { document.getElementById(id).textContent = value; };
    set("spike-rate", Math.round(brain.rate)); set("dopamine", brain.dopamine.toFixed(2));
    set("novelty", `${Math.round(brain.novelty * 100)}%`);
    this.neural.clearRect(0, 0, 180, 180);
    for (let i = 0; i < 892; i++) {
      this.neural.fillStyle = brain.spikes[i] ? "#fff0a8" : `rgba(150,206,159,${0.08 + Math.min(1, brain.voltage[i]) * 0.8})`;
      this.neural.fillRect((i % 30) * 6, (29 - Math.floor(i / 30)) * 6, 5, 5);
    }
    brain.quadrants.forEach((value, i) => {
      const cell = document.getElementById(`interest-${i}`);
      cell.querySelector("b").textContent = `${Math.round(value * 100)}%`;
      cell.style.background = `rgba(200,236,149,${Math.min(0.5, value)})`;
      cell.dataset.activation = String(value);
    });
    for (const dir of ["up", "down", "left", "right"]) set(`attention-${dir}`, `${Math.round(brain[dir] * 100)}%`);
    const dot = document.getElementById("attention-dot");
    dot.style.left = `${50 + brain.steer * 43}%`; dot.style.top = `${50 - brain.vertical * 43}%`;
    this.history.clearRect(0, 0, 480, 64);
    for (const [values, color] of [[brain.spikeHistory, "#badc95"], [brain.history, "#e8ac76"]]) {
      this.history.strokeStyle = color; this.history.lineWidth = 2; this.history.beginPath();
      values.forEach((v, i) => { const x = i / 99 * 480, y = 62 - Math.min(1, v) * 58;
        i ? this.history.lineTo(x, y) : this.history.moveTo(x, y); });
      this.history.stroke();
    }
    this.touch.clearRect(0, 0, 264, 8);
    brain.touchSpikes.forEach((v, i) => { this.touch.fillStyle = v ? "#ffac7c" : "#a6bb7e25"; this.touch.fillRect(i * 6, 0, 4, 8); });
  }
}
