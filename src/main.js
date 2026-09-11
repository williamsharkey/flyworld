import "./style.css";
import {
  createIcons,
  Pause,
  Play,
  ChevronsRight,
  Video,
  Shuffle,
  SlidersHorizontal,
  VolumeX,
  Volume2,
  Maximize,
  RefreshCw,
} from "lucide";
const icons = {
  Pause,
  Play,
  ChevronsRight,
  Video,
  Shuffle,
  SlidersHorizontal,
  VolumeX,
  Volume2,
  Maximize,
  RefreshCw,
};
import { Ecosystem, FlyBrain } from "./simulation.js";
import { FlyWorld } from "./world.js";
import { TrailMap } from "./exploration.js";
import { FlightInput } from "./controls.js";
import { DreamSynth } from "./audio.js";

const icon = (name, cls = "") =>
  `<i data-lucide="${name}" class="icon ${cls}"></i>`;
const app = document.querySelector("#app");
app.innerHTML = `
<canvas id="world" aria-label="Fly through an evolving voxel world"></canvas>
<section class="map-panel" aria-label="Exploration map"><canvas id="orbit" width="480" height="160" aria-label="Explored paths"></canvas><span id="coverage">0.00%</span></section>
<nav class="controls" aria-label="Simulation controls"><button id="pause" class="control-button primary" title="Pause simulation" aria-label="Pause simulation">${icon("pause")}</button><button id="speed" class="control-button" title="Change simulation speed"><span id="speed-label">1×</span>${icon("chevrons-right")}</button><span class="control-sep"></span><button id="camera" class="control-button active" title="Change camera (C)">${icon("video")}<span class="camera-label" id="camera-label">Follow</span></button><button id="mutate" class="control-button mutate" title="Mutate the landscape ahead (M)">${icon("shuffle")}<span>Mutate</span></button><span class="control-sep"></span><button id="settings" class="control-button icon-only" title="Evolution settings" aria-label="Evolution settings" aria-expanded="false">${icon("sliders-horizontal")}</button><button id="sound" class="control-button icon-only" title="Mute music and ambience" aria-label="Mute music and ambience" aria-pressed="true">${icon("volume-2")}</button><button id="immersive" class="control-button icon-only" title="Screensaver mode (F)" aria-label="Enter screensaver mode">${icon("maximize")}</button></nav>
<section id="settings-popover" class="settings-popover" hidden><h3>Settings</h3><div class="setting-row"><label for="mutation">Mutation strength</label><output id="mutation-value">55%</output></div><input id="mutation" type="range" min="0" max="80" value="55"/><div class="setting-row"><label for="evolve">Natural selection</label><input class="switch" id="evolve" type="checkbox" checked/></div><div class="setting-row"><label for="autosteer">Visual steering</label><input class="switch" id="autosteer" type="checkbox" checked/></div><div class="setting-row"><label for="music-volume">Volume</label><output id="music-volume-value">50%</output></div><input id="music-volume" type="range" min="0" max="100" value="50"/><a class="midi-link" href="${import.meta.env.BASE_URL}wandering-light.mid" download="wandering-light.mid">Download the original MIDI ↗</a><button id="new-world" class="control-button active" style="width:100%;margin-top:15px">${icon("refresh-cw")} Reseed the world</button></section>
<button class="exit-immersive" id="exit-immersive" hidden aria-label="Show controls">${icon("maximize")}</button>
<div class="toast" id="toast" role="status"></div><div class="loading" id="loading" role="status">Loading…</div>`;
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
  toastTimer;
try {
  world = new FlyWorld($("world"), ecosystem);
} catch (error) {
  console.error(error);
  $("loading").innerHTML =
    "Enable hardware acceleration and reload to run this world.";
  throw error;
}
const trailMap = new TrailMap($("orbit"), world);
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
  synth.setPaused(paused);
}
$("pause").onclick = togglePause;
$("speed").onclick = () => {
  speed = { 1: 2, 2: 4, 4: 0.5, 0.5: 1 }[speed];
  $("speed-label").textContent = `${speed}×`;
  toast(`Moving at ${speed}× · ${formatTime(75 / speed)} per straight lap`);
};
function cycleCamera() {
  world.cameraMode = (world.cameraMode + 1) % 3;
  $("camera-label").textContent = ["Follow", "Overlook", "Fly eye"][
    world.cameraMode
  ];
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
  toast("World reset");
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
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    setImmersive(false);
    $("settings-popover").hidden = true;
    $("settings").setAttribute("aria-expanded", "false");
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
function updateUI() {
  $("coverage").textContent =
    `${(world.exploration.coverage * 100).toFixed(2)}%`;
  trailMap.draw();
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
    if (event.type === "shot" && !$("arcade-reticle")) {
      const reticle = document.createElement("div");
      reticle.id = "arcade-reticle";
      reticle.setAttribute("aria-hidden", "true");
      document.body.append(reticle);
    }
  }
  const reticle = $("arcade-reticle");
  if (reticle) {
    const age = world.wallTime - world.arcade.lastFireTime;
    reticle.style.opacity = String(
      Math.max(0, Math.min(1, 1 - (age - 2) / 0.45)),
    );
    if (age >= 2.45) reticle.remove();
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
      escapes: world.physics.escapes,
      escapeActive: world.physics.contactClock < world.physics.escapeUntil,
      lastFire: world.arcade.lastFireTime,
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
  window.flyworld.testing = { world, brain, input: flightInput, synth };
