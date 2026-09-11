import "./style.css";
import {
  createIcons,
  ArrowUpRight,
  Orbit,
  Bug,
  Zap,
  Sparkles,
  ScanEye,
  Sprout,
  Pause,
  Play,
  ChevronsRight,
  Video,
  Shuffle,
  SlidersHorizontal,
  VolumeX,
  Volume2,
  Maximize,
  Dna,
  RefreshCw,
  X,
} from "lucide";
const icons = {
  ArrowUpRight,
  Orbit,
  Bug,
  Zap,
  Sparkles,
  ScanEye,
  Sprout,
  Pause,
  Play,
  ChevronsRight,
  Video,
  Shuffle,
  SlidersHorizontal,
  VolumeX,
  Volume2,
  Maximize,
  Dna,
  RefreshCw,
  X,
};
import {
  Ecosystem,
  FlyBrain,
  SPECIES,
  WORLD,
  TAU,
  random,
  FORMS,
} from "./simulation.js";
import { FlyWorld } from "./world.js";
import { TrailMap } from "./exploration.js";
import { FlightInput } from "./controls.js";
import { DreamSynth } from "./audio.js";

const icon = (name, cls = "") =>
  `<i data-lucide="${name}" class="icon ${cls}"></i>`;
const app = document.querySelector("#app");
app.innerHTML = `
<canvas id="world" aria-label="An evolving Three.js voxel world with a naturally flying observer on a toroidal surface"></canvas><div class="vignette"></div>
<header><a class="brand" href="./" aria-label="Flyworld home"><svg class="brand-mark" viewBox="0 0 40 40" fill="none"><ellipse cx="13" cy="16" rx="7" ry="12" transform="rotate(-35 13 16)" fill="#e1e5cb"/><ellipse cx="27" cy="16" rx="7" ry="12" transform="rotate(35 27 16)" fill="#e1e5cb"/><path d="M20 14v20" stroke="#ddbd8f" stroke-width="6" stroke-linecap="round"/><path d="m17 9-3-5m9 5 3-5" stroke="#e1e5cb" stroke-width="1.4"/></svg><span class="brand-name">flyworld<span class="brand-dot">.</span></span><span class="brand-tag">An evolving little universe</span></a><div class="header-right"><span class="live"><i id="live-dot"></i><span id="live-label">SIMULATION LIVE</span></span><span class="elapsed" id="elapsed">00:00:00</span><span class="header-divider"></span><button class="about-button" id="about">About the experiment ${icon("arrow-up-right")}</button></div></header>
<section class="intro"><div class="eyebrow">WORLD 001 &nbsp;/&nbsp; OPEN-ENDED EVOLUTION</div><h1>A world worth<br>watching.</h1><p>One small brain. An ever-changing landscape.<br>A little more delightful with every loop.</p><div class="world-label">${icon("orbit")} TOROIDAL WORLD <span style="opacity:.4">/</span> NO EDGES. NO END.</div></section>
<aside class="sidebar"><section class="panel observer-panel"><div class="panel-heading"><span>THE OBSERVER</span><span class="subtle">01 / DROSOPHILA</span></div><div class="observer-title"><div class="fly-small">${icon("bug")}</div><div><strong>A curious explorer</strong><small>Eyes forward. Mind wandering.</small></div><span class="proxy" title="Compact spiking proxy, not the measured FlyEM connectome">PROXY</span></div><div class="neural-view"><canvas id="neural" width="464" height="145" aria-label="Live spiking neural activity"></canvas><span class="neural-label">892 VISUAL + 44 TOUCH</span></div><div class="metrics"><div><div class="metric-title">${icon("zap")} Neural activity</div><div class="metric-value"><span id="spike-rate">0</span><small>spikes/s</small></div><canvas class="sparkline" id="spike-chart" width="210" height="56"></canvas></div><div><div class="metric-title">${icon("sparkles")} Reward proxy</div><div class="metric-value"><span id="dopamine">0.50</span><small>DA</small></div><canvas class="sparkline" id="reward-chart" width="210" height="56"></canvas></div></div><div class="observer-bottom"><span class="status-dot"></span><span id="brain-status">Learning from the view</span></div></section>
<section class="panel eye-panel"><div class="panel-heading"><span>THROUGH ITS EYES</span>${icon("scan-eye")}</div><div class="eye-head"><span>892 columns · 30 × 30 light samples</span><span>LIVE</span></div><div class="eye-wrap"><canvas id="eye" width="30" height="30" aria-label="Actual low-resolution view used by the fly's visual model"></canvas><div class="eye-quadrants"><span id="interest-0">UP LEFT</span><span id="interest-1">UP RIGHT</span><span id="interest-2">DOWN LEFT</span><span id="interest-3">DOWN RIGHT</span></div></div><div class="steering"><span>← L</span><div class="steering-track"><span id="steer-dot"></span></div><span>R →</span><span id="steer-label">Seeking balance</span></div><div class="novelty-readout"><span>Visual novelty <b id="novelty">100%</b></span><span><b id="swap-count">0</b> form swaps</span></div></section></aside>
<div class="scene-caption"><span class="line"></span><span id="camera-caption">Following the observer</span><small> / &nbsp; gently, endlessly.</small></div>
<div class="bottom-area"><section class="orbit-panel map-panel"><div class="map-heading"><span>FLIGHT MEMORY</span><span id="lap-number">Loop 001</span></div><canvas id="orbit" width="480" height="160" aria-label="Explored paths on an unwrapped torus; repeated visits become brighter"></canvas><div class="map-meta"><strong id="coverage">0.00% touched</strong><span id="visited-cells">1 cell</span></div><div class="map-key"><span>FAINT → FAMILIAR</span><span id="loop-time">01:15 / straight lap</span></div><span id="loop-progress" hidden></span></section><div class="center-bottom"><div class="event">${icon("sprout")}<span id="event-text">A small world. An open-ended experiment.</span></div><nav class="controls" aria-label="Simulation controls"><button id="pause" class="control-button primary" title="Pause simulation" aria-label="Pause simulation">${icon("pause")}</button><button id="speed" class="control-button" title="Change simulation speed"><span id="speed-label">1×</span>${icon("chevrons-right")}</button><span class="control-sep"></span><button id="camera" class="control-button active" title="Change camera (C)">${icon("video")}<span class="camera-label" id="camera-label">Follow</span></button><button id="mutate" class="control-button mutate" title="Mutate the landscape ahead (M)">${icon("shuffle")}<span>Mutate</span></button><span class="control-sep"></span><button id="settings" class="control-button icon-only" title="Evolution settings" aria-label="Evolution settings" aria-expanded="false">${icon("sliders-horizontal")}</button><button id="sound" class="control-button icon-only" title="Mute music and ambience" aria-label="Mute music and ambience" aria-pressed="true">${icon("volume-2")}</button><button id="immersive" class="control-button icon-only" title="Screensaver mode (F)" aria-label="Enter screensaver mode">${icon("maximize")}</button></nav><section class="ecosystem"><div class="eco-top"><span>12 WORLD FORMS · ENDLESS COMBINATIONS</span><b><span class="status-dot"></span> &nbsp; 8 interdependent species</b></div><div class="species-list">${SPECIES.map((s, i) => `<button class="species-button" data-species="${i}" style="--species:${s.color}" title="Explore ${s.name}"><span class="species-name"><span class="species-dot"></span>${s.short}</span><div class="species-bar"><div class="species-fill" id="species-${i}"></div></div></button>`).join("")}</div></section></div><section class="world-stats"><div class="world-stats-heading"><span>NATURAL SELECTION, REIMAGINED</span>${icon("dna")}</div><div class="stat-row"><span>Generation</span><strong id="generation">001</strong></div><div class="stat-row"><span>Ecosystem fitness</span><strong id="fitness">—</strong></div><div class="stat-row"><span>Living voxels</span><strong id="voxels">—</strong></div><div class="tiny-footer"><span>BUILT WITH THREE.JS</span><a href="https://github.com/fruitflydev/flycoinrh" target="_blank" rel="noopener noreferrer">INSPIRED BY FLYBRAIN ↗</a></div></section></div><div class="corner-note">A QUIET EXPERIMENT IN ARTIFICIAL LIFE</div>
<section id="settings-popover" class="settings-popover" hidden><h3>Let the world find its way</h3><div class="setting-row"><label for="mutation">Mutation strength</label><output id="mutation-value">55%</output></div><input id="mutation" type="range" min="0" max="80" value="55"/><div class="setting-row"><label for="evolve">Natural selection</label><input class="switch" id="evolve" type="checkbox" checked/></div><div class="setting-row"><label for="autosteer">Visual steering</label><input class="switch" id="autosteer" type="checkbox" checked/></div><p class="popover-note">Successful genomes persist across both world seams. The fly steers toward the visual field with a stronger reward response.</p><div class="setting-row"><label for="music-volume">Wandering Light · synth score</label><output id="music-volume-value">50%</output></div><input id="music-volume" type="range" min="0" max="100" value="50"/><a class="midi-link" href="${import.meta.env.BASE_URL}wandering-light.mid" download="wandering-light.mid">Download the original MIDI ↗</a><button id="new-world" class="control-button active" style="width:100%;margin-top:15px">${icon("refresh-cw")} Reseed the world</button></section>
<div class="modal-backdrop" id="modal-backdrop" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="close" id="close-modal" aria-label="Close dialog">${icon("x")}</button><div id="modal-content"></div></section></div><button class="exit-immersive" id="exit-immersive" hidden>Back to the experiment &nbsp; ↗</button><div class="toast" id="toast" role="status"></div><div class="loading" id="loading"><h2>flyworld<span style="color:#dbb886">.</span></h2><p><span class="loading-dot"></span> Growing a little universe…</p></div>`;
createIcons({ icons });
const $ = (id) => document.getElementById(id);
const synth = new DreamSynth();
const flightInput = new FlightInput();
let manualControl = { bias: 0, vertical: 0, active: false, mix: 0 };
let ecosystem = new Ecosystem(),
  brain = new FlyBrain(),
  world;
let paused = false,
  speed = 1,
  autosteer = true,
  immersive = false,
  lastTime = 0,
  senseTime = 0,
  evoTime = 0,
  uiTime = 0,
  toastTimer,
  previousFocus;
try {
  world = new FlyWorld($("world"), ecosystem);
} catch (error) {
  console.error(error);
  $("loading").innerHTML =
    "<h2>A little more graphics power</h2><p>This world needs a browser with WebGL 2 enabled.<br>Try enabling hardware acceleration and reloading.</p>";
  throw error;
}
const trailMap = new TrailMap($("orbit"), world);
const eyeCtx = $("eye").getContext("2d"),
  eyeImage = eyeCtx.createImageData(30, 30),
  neuralCtx = $("neural").getContext("2d");
const rng = random(481),
  neuralPoints = Array.from({ length: 180 }, () => {
    const side = rng() > 0.5 ? 1 : -1,
      angle = rng() * TAU,
      rad = Math.sqrt(rng());
    return {
      x: 232 + side * 70 + Math.cos(angle) * rad * 94,
      y: 69 + Math.sin(angle) * rad * 52,
      id: Math.floor(rng() * 892),
    };
  });
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3200);
}
function setButton(id, name) {
  $(id).innerHTML = icon(name);
  createIcons({ icons });
}
function togglePause() {
  paused = !paused;
  setButton("pause", paused ? "play" : "pause");
  $("pause").setAttribute(
    "aria-label",
    paused ? "Resume simulation" : "Pause simulation",
  );
  $("pause").title = paused ? "Resume simulation" : "Pause simulation";
  $("live-label").textContent = paused
    ? "SIMULATION PAUSED"
    : "SIMULATION LIVE";
  $("live-dot").style.background = paused ? "#dfb582" : "#d1deac";
  synth.setPaused(paused);
}
$("pause").onclick = togglePause;
$("speed").onclick = () => {
  speed = { 1: 2, 2: 4, 4: 0.5, 0.5: 1 }[speed];
  $("speed-label").textContent = `${speed}×`;
  $("loop-time").innerHTML =
    `${formatTime(75 / speed)} <span style="font-size:10px;color:#aab89c">/ lap</span>`;
  toast(`Moving at ${speed}× · ${formatTime(75 / speed)} per straight lap`);
};
function cycleCamera() {
  world.cameraMode = (world.cameraMode + 1) % 3;
  $("camera-label").textContent = ["Follow", "Overlook", "Fly eye"][
    world.cameraMode
  ];
  $("camera-caption").textContent = [
    "Following the observer",
    "A wider perspective",
    "Seeing what the fly sees",
  ][world.cameraMode];
}
$("camera").onclick = cycleCamera;
function mutate() {
  const changed = ecosystem.evolve(
    world.u,
    world.v,
    brain.dopamine,
    true,
    world.heading,
  );
  world.markDirty(changed);
  world.updateChunks();
  toast(`${changed.length} new genomes planted ahead`);
  updateUI();
}
$("mutate").onclick = mutate;
$("settings").onclick = () => {
  const isHidden = $("settings-popover").hidden;
  $("settings-popover").hidden = !isHidden;
  $("settings").setAttribute("aria-expanded", String(isHidden));
};
$("mutation").oninput = (e) => {
  ecosystem.mutation = Number(e.target.value) / 100;
  $("mutation-value").textContent = `${e.target.value}%`;
};
$("evolve").onchange = (e) => {
  ecosystem.frozen = !e.target.checked;
  toast(
    e.target.checked
      ? "Natural selection resumed"
      : "Evolution paused · the fly keeps exploring",
  );
};
$("autosteer").onchange = (e) => {
  autosteer = e.target.checked;
  toast(
    autosteer
      ? "The fly is choosing its path"
      : "Steering centered · forward exploration",
  );
};
$("new-world").onclick = () => {
  const next = new Ecosystem(Math.floor(Math.random() * 1e8));
  next.mutation = ecosystem.mutation;
  next.frozen = ecosystem.frozen;
  ecosystem = next;
  world.ecosystem = next;
  brain = new FlyBrain();
  world.reset();
  flightInput.clear();
  document.getElementById("arcade-reticle")?.remove();
  toast("A fresh genome pool. A new beginning.");
  updateUI();
};
function setImmersive(value) {
  immersive = value;
  document.body.classList.toggle("immersive", value);
  $("exit-immersive").hidden = !value;
  $("settings-popover").hidden = true;
  $("settings").setAttribute("aria-expanded", "false");
}
$("immersive").onclick = () => setImmersive(true);
$("exit-immersive").onclick = () => setImmersive(false);
$("sound").onclick = async () => {
  $("sound").disabled = true;
  try {
    const on = !synth.enabled;
    await synth.setEnabled(on);
    $("sound").setAttribute("aria-pressed", String(on));
    $("sound").setAttribute(
      "aria-label",
      on ? "Mute music and ambience" : "Enable music and ambience",
    );
    $("sound").title = on
      ? "Mute Wandering Light"
      : "Play Wandering Light · original synth score";
    setButton("sound", on ? "volume-2" : "volume-x");
    if (on) toast("Wandering Light · warm pads, soft arpeggios, open skies");
  } catch {
    toast("Audio is unavailable in this browser.");
  } finally {
    $("sound").disabled = false;
  }
};
$("music-volume").oninput = (e) => {
  synth.setVolume(Number(e.target.value) / 100);
  $("music-volume-value").textContent = `${e.target.value}%`;
};
function showModal(content) {
  flightInput.clear();
  world.arcade.release();
  previousFocus = document.activeElement;
  $("modal-content").innerHTML = content;
  $("modal-backdrop").hidden = false;
  $("close-modal").focus();
}
function closeModal() {
  $("modal-backdrop").hidden = true;
  previousFocus?.focus();
}
$("close-modal").onclick = closeModal;
$("modal-backdrop").onclick = (e) => {
  if (e.target === $("modal-backdrop")) closeModal();
};
$("about").onclick = () =>
  showModal(
    `<span class="modal-tag">AN EXPERIMENT IN ARTIFICIAL LIFE</span><h2 id="modal-title">What makes a world<br>worth watching?</h2><p>A fly flies freely through a world that is learning to be seen. Trees, coral, crystals, and tiny creatures compete for space — and find ways to help each other grow.</p><div class="fact-grid"><div><strong>892</strong><small>Visual columns in this demo</small></div><div><strong>01:15</strong><small>Straight lap at 1× speed</small></div></div><p>The landscape wraps forward and sideways like a torus. The fly compares all four quadrants of its actual rendered view and steers toward the stronger response. The camera catches up gently. The fly banks, flaps its wings, and climbs above mountains and water. Its minimap remembers cell crossings: revisits become brighter.</p><p><b>A transparent little model.</b> This demo uses 892 visual and 44 tactile leaky spiking units and a dopamine-like reward proxy. Its small plastic readout uses dopamine-gated depression. It does not load or simulate the measured 165,122-neuron FlyEM connectome, and the reward is a designed signal, not a claim about pleasure.</p><p>Inspired by <a href="https://github.com/fruitflydev/flycoinrh" target="_blank" rel="noopener noreferrer">the open-source FlyBrain project ↗</a>. The source project’s measured connectome and backend are separate from this browser experiment.</p><p>Eight ecological species and twelve landscape grammars compete for visual attention. Familiar colors habituate; rare forms and surprising motion receive a novelty bonus. Hunters pursue prey, flocks scatter and reform, and entire patches swap form. Low terrain fills with water; high terrain forms rocky peaks.</p><p>Four visual quadrants guide horizontal and vertical attention. Arrow keys gently add directional attention and altitude velocity: Up dives, Down climbs. After half a second without arrow input, the fly brain takes over. Contacts excite 44 region-specific tactile proxy units and trigger withdrawal. Sustained steering twists the local surface around the fly; the twist fades smoothly before the torus seams.</p><p>The soundtrack, <b>Wandering Light</b>, is an original 72 BPM composition with detuned pads, filter sweeps, stereo chorus, and reverb. Its MIDI score is available in Settings.</p><p style="font-size:10px">← → steer &nbsp; · &nbsp; ↑ dive / ↓ climb &nbsp; · &nbsp; C camera &nbsp; · &nbsp; M mutate &nbsp; · &nbsp; F screensaver &nbsp; · &nbsp; ESC return</p>`,
  );
for (const button of document.querySelectorAll("[data-species]"))
  button.onclick = () => {
    const i = Number(button.dataset.species),
      s = SPECIES[i],
      pop = ecosystem.population(world.u, world.v, world.heading);
    showModal(
      `<span class="modal-tag">THE GENOME POOL / SPECIES 0${i + 1}</span><h2 id="modal-title">${s.name}</h2><div class="species-detail" style="--species:${s.color}"><span style="font-size:11px;color:${s.color}">${s.role}</span><p>${s.description}</p></div><div class="fact-grid"><div><strong>${(pop.shares[i] * 100).toFixed(1)}%</strong><small>Nearby genome share</small></div><div><strong>${ecosystem.generation}</strong><small>Current generation</small></div></div><p>Each patch carries a eight-species genome. Candidate offspring mix neighboring genes, mutate, and compete on visual response, diversity, resource cost, and mutual dependence. Selected variants persist when the fly loops back.</p>`,
    );
  };
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    setImmersive(false);
    $("settings-popover").hidden = true;
    $("settings").setAttribute("aria-expanded", "false");
    return;
  }
  if (!$("modal-backdrop").hidden) {
    if (e.key === "Tab") {
      const nodes = $("modal-backdrop").querySelectorAll("button,a[href]");
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    return;
  }
  if (document.activeElement.tagName === "INPUT") return;
  if (flightInput.key(e.code, true, performance.now() / 1000)) {
    e.preventDefault();
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) {
      if (paused) togglePause();
      world.arcade.press();
      if (!document.getElementById("arcade-reticle")) {
        const reticle = document.createElement("div");
        reticle.id = "arcade-reticle";
        reticle.setAttribute("aria-hidden", "true");
        document.body.append(reticle);
      }
    }
  }
  if (e.key.toLowerCase() === "c") cycleCamera();
  if (e.key.toLowerCase() === "m") mutate();
  if (e.key.toLowerCase() === "f") setImmersive(!immersive);
});
window.addEventListener("keyup", (e) => {
  flightInput.key(e.code, false, performance.now() / 1000);
  if (e.code === "Space") {
    e.preventDefault();
    world.arcade.release();
  }
});
window.addEventListener("blur", () => {
  flightInput.clear();
  world.arcade.release();
});
async function unlockAudio(event) {
  if (
    event?.target?.closest?.("#sound") ||
    !synth.enabled ||
    synth.ctx?.state === "running"
  )
    return;
  try {
    await synth.init();
    await synth.sync();
  } catch {}
}
window.addEventListener("pointerdown", unlockAudio, { capture: true });
window.addEventListener("keydown", unlockAudio, { capture: true });
function formatTime(seconds) {
  const m = Math.floor(seconds / 60),
    s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function chart(id, values, c) {
  const canvas = $(id),
    ctx = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / 99) * w,
      y = h - 5 - v * (h - 9);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.lineTo(((values.length - 1) / 99) * w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, c + "33");
  grad.addColorStop(1, c + "00");
  ctx.fillStyle = grad;
  ctx.fill();
}
function drawNeural() {
  brain.quadrants.forEach((value, i) => {
    const cell = $("interest-" + i);
    cell.style.backgroundColor = `rgba(239, 210, 160, ${Math.min(0.35, value * 0.9)})`;
    cell.textContent =
      ["UP LEFT", "UP RIGHT", "DOWN LEFT", "DOWN RIGHT"][i] +
      " " +
      Math.round(value * 100) +
      "%";
  });
  const ctx = neuralCtx;
  ctx.clearRect(0, 0, 464, 145);
  for (let i = 0; i < neuralPoints.length; i++) {
    const p = neuralPoints[i],
      active = brain.spikes[p.id];
    if (i % 3 === 0) {
      const q = neuralPoints[(i + 13) % neuralPoints.length];
      if (Math.abs(p.x - q.x) < 65) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = active ? "#c8d5a443" : "#c8d5a410";
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
    }
    ctx.fillStyle = active ? "#efd2a0" : "#b8c99b65";
    ctx.beginPath();
    ctx.arc(p.x, p.y, active ? 2 : 1.1, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 44; i++) {
    ctx.fillStyle = brain.touchSpikes[i] ? "#f0aa88" : "#9aaa7833";
    ctx.fillRect(25 + i * 9.4, 132, 4, 4);
  }
}
function drawOrbit() {
  trailMap.draw();
}
function updateUI() {
  const time = world.simTime,
    pop = ecosystem.population(world.u, world.v, world.heading);
  $("elapsed").textContent =
    `${String(Math.floor(time / 3600)).padStart(2, "0")}:${formatTime(time % 3600)}`;
  $("spike-rate").textContent =
    brain.rate >= 1000
      ? `${(brain.rate / 1000).toFixed(1)}k`
      : String(Math.round(brain.rate));
  $("dopamine").textContent = brain.dopamine.toFixed(2);
  $("coverage").textContent =
    `${(world.exploration.coverage * 100).toFixed(2)}% touched`;
  $("visited-cells").textContent =
    `${world.exploration.unique.toLocaleString()} cells · ${world.exploration.entries.toLocaleString()} passes`;
  $("novelty").textContent = `${Math.round(brain.novelty * 100)}%`;
  $("swap-count").textContent = ecosystem.swaps.toLocaleString();
  $("generation").textContent = String(ecosystem.generation).padStart(3, "0");
  $("fitness").textContent = pop.fitness.toFixed(3);
  $("voxels").textContent = world.voxels.toLocaleString();
  $("lap-number").textContent =
    `Journey ${String(Math.floor(world.physics.distance / 960) + 1).padStart(3, "0")}`;
  $("loop-progress").textContent =
    `${((time % 300) / 3).toFixed(1)}% through this lap`;
  $("steer-dot").style.left = `${50 + (autosteer ? brain.steer : 0) * 43}%`;
  $("steer-label").textContent = !autosteer
    ? "Forward only"
    : Math.abs(brain.vertical) > Math.max(0.08, Math.abs(brain.steer))
      ? brain.vertical > 0
        ? "Drawn upward"
        : "Drawn downward"
      : Math.abs(brain.steer) < 0.08
        ? "Seeking balance"
        : brain.steer > 0
          ? "Drawn to the right"
          : "Drawn to the left";
  $("brain-status").textContent = paused
    ? "A moment of stillness"
    : brain.touchAge < 1.2
      ? `${brain.lastTouch} contact · withdrawing`
      : manualControl.active
        ? "Following your attention"
        : brain.dopamine > 0.48
          ? "Something caught its eye"
          : "Learning from the view";
  $("event-text").textContent = ecosystem.frozen
    ? "The world holds still. The journey continues."
    : ecosystem.lastEvent;
  pop.shares.forEach(
    (share, i) => ($("species-" + i).style.width = `${share * 340}%`),
  );
  chart("spike-chart", brain.spikeHistory, "#c0d299");
  chart("reward-chart", brain.history, "#e7b47d");
  drawNeural();
  drawOrbit();
}
let renderUntil = 0,
  renderSignature = "";
let ready = false,
  qualityTime = 0,
  qualityFrames = 0;
document.addEventListener("visibilitychange", () => {
  lastTime = 0;
  flightInput.clear();
  world.arcade.release();
  synth.sync().catch(() => {});
});
function animate(now) {
  requestAnimationFrame(animate);
  const realDt = Math.min((now - (lastTime || now)) / 1000, 1);
  lastTime = now;
  if (document.hidden) return;
  qualityTime += realDt;
  qualityFrames++;
  if (qualityTime > 3) {
    const fps = qualityFrames / qualityTime;
    if (fps < 28 && world.pixelRatio > 0.6)
      world.setQuality(world.pixelRatio * 0.8);
    qualityTime = 0;
    qualityFrames = 0;
  }
  const dt = paused ? 0 : realDt * speed * 4;
  manualControl = flightInput.update(
    realDt,
    now / 1000,
    autosteer ? brain.steer : 0,
    autosteer ? brain.vertical : 0,
  );
  world.update(dt, manualControl.bias, realDt, manualControl.vertical);
  for (const event of world.consumeEvents()) {
    if (event.type === "contact") brain.touch(event.region, event.intensity);
    synth.event(event, world);
  }
  if (!paused) synth.environment(world, manualControl.bias);
  if (dt) {
    senseTime += dt;
    evoTime += dt;
  }
  if (senseTime >= 0.1 || !ready) {
    const pixels = world.sense();
    if (!ready) senseTime = 0.1;
    while (senseTime >= 0.1) {
      brain.step(pixels, 0.1);
      senseTime -= 0.1;
    }
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < 30; x++) {
        const src = (y * 30 + x) * 4,
          dst = ((29 - y) * 30 + x) * 4;
        eyeImage.data[dst] = pixels[src];
        eyeImage.data[dst + 1] = pixels[src + 1];
        eyeImage.data[dst + 2] = pixels[src + 2];
        eyeImage.data[dst + 3] = 255;
      }
    eyeCtx.putImageData(eyeImage, 0, 0);
  }
  synth.reward(brain.dopamine);
  while (evoTime >= 0.85) {
    ecosystem.observe(world.u, world.v, brain.novelty, 0.85, world.heading);
    world.markDirty(
      ecosystem.evolve(world.u, world.v, brain.dopamine, false, world.heading),
    );
    evoTime -= 0.85;
  }
  const signature = `${paused}:${world.cameraMode}:${ecosystem.seed}:${ecosystem.generation}:${innerWidth}:${innerHeight}:${world.pixelRatio}`;
  if (signature !== renderSignature) {
    renderUntil = now + 1500;
    renderSignature = signature;
  }
  if (!paused || now < renderUntil || !ready) world.render();
  uiTime += realDt;
  if (uiTime > 0.2 || !ready) {
    updateUI();
    uiTime = 0;
  }
  if (!ready) {
    ready = true;
    synth.arm().catch(() => {});
    $("loading").style.opacity = "0";
    setTimeout(() => ($("loading").hidden = true), 750);
  }
}
requestAnimationFrame(animate);
// Read-only diagnostics for reproducible browser checks and future backend integration.
window.flyworld = {
  get state() {
    return {
      u: world.u,
      v: world.v,
      centerV: world.centerV,
      time: world.simTime,
      steer: brain.steer,
      verticalInterest: brain.vertical,
      quadrants: [...brain.quadrants],
      dopamine: brain.dopamine,
      spikes: brain.rate,
      generation: ecosystem.generation,
      accepted: ecosystem.accepted,
      trials: ecosystem.trials,
      patches: ecosystem.patches.size,
      voxels: world.voxels,
      altitude: world.altitude,
      ground: world.height(world.u, world.v),
      coverage: world.exploration.coverage,
      visited: world.exploration.unique,
      entries: world.exploration.entries,
      novelty: brain.novelty,
      forms: new Set([...ecosystem.patches.values()].map((p) => p.form)).size,
      swaps: ecosystem.swaps,
      creatures: world.fauna.agents.length,
      encounters: world.fauna.encounters,
      music: synth.state,
      wingAngle: world.wings[0].rotation.z,
      heading: world.heading,
      contacts: world.physics.contacts,
      touchCount: brain.touchCount,
      lastTouch: brain.lastTouch,
      tactileSpikes: Array.from(brain.touchSpikes),
      recoil: world.physics.back,
      manual: { ...manualControl },
      velocity: world.physics.verticalVelocity,
      shots: world.arcade.fired,
      projectiles: world.arcade.shots.length,
      destroyed: world.arcade.destroyed,
      scars: world.damage.count,
      fragments: world.arcade.fragments.length,
      transitioning: world.transitions.mesh.count,
      arcade: world.arcade.discovered,
      observer: world.observer.name,
      drawCalls: world.renderer.info.render.calls,
      paused,
      speed,
      camera: world.cameraMode,
    };
  },
};

if (import.meta.env.DEV)
  window.flyworld.testing = { world, brain, input: flightInput };
