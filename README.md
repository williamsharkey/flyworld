# Flyworld

A living Three.js screensaver: a fruit fly explores a toroidal voxel world that evolves to surprise its visual system.

**[Run Flyworld](https://williamsharkey.github.io/flyworld/)** · [Source](https://github.com/williamsharkey/flyworld)

No installation is needed to play. Every visitor gets an independent simulation in their browser.

## What happens

- **Natural flight:** a segmented fly with veined, translucent wings flaps, banks, pitches, and gently bobs. It anticipates terrain rises and climbs above them. Smooth attention changes steer and climb. Beyond ±4% steering bias, the surface pivots under the fly, with a gentle camera catch-up. Eleven swept body/leg/wing probes detect voxels and trigger backward/upward recoil; contacts excite 44 region-specific tactile proxy neurons.
- **Twelve landscape grammars:** amber groves, coral gardens, crystal fans, giant mushrooms, stone arches, floating islands, spiral towers, flower meadows, basalt pillars, reed marshes, luminous rings, and branching ruins. Whole patches can change form. Individual incoming and outgoing cubes grow or shrink around their own centers with a 0.4-second smoothstep, timed independently of simulation speed. Unchanged cubes retain their identity. GPU attributes animate the scale; a bounded instanced batch holds outgoing cubes. Colliders follow the animated sizes. Tiny deterministic size offsets separate overlapping decorative faces.
- **Active fauna:** 90 bounded agents include hunters, flocking flies, grazers, pollinators, surface skimmers, and drifting insects. Hunters pursue nearby prey; flies separate, align, and flee. A periodic spatial hash limits neighbor searches. These are stylized ecological behaviors, not a biological predator model.
- **Evolving topography:** elevation and roughness are inherited traits. Continuous periodic terrain is quantized into voxel steps. Terrain below a common water level forms rivers and pools; elevated regions become hills and rocky peaks. Water has animated ripples. Water is a level-set surface, not a fluid or erosion simulation.
- **Flight memory:** a minimap shows the entire unwrapped torus. Visited cells appear translucent; additional crossings make them more opaque. The percentage is unique 4×4-unit cells visited out of 19,200. The map interpolates movement across both seams, and hovering does not add visits.
- **Original music:** *Wandering Light*, a relaxing 72 BPM MIDI-style composition, plays through a Web Audio synth with detuned sawtooth pads, slow low-pass sweeps, stereo chorus, reverb, arpeggios, and a soft bass. The tone evokes vintage Juno/Oberheim-style textures. It is an original composition, not a transcription of *The NeverEnding Story*. Download its five-track MIDI in Settings. Audio attempts to start automatically; if blocked by the browser, the first interaction unlocks it with a gentle fade-in. Much quieter insect buzzes, wing strokes, filtered water, impacts, and spatial rearrangement whooshes accompany the score. Nearby insects pan, lose high frequencies with distance, and shift pitch with Doppler motion.

## The brain is an explicit proxy

The eye camera renders the actual scene to a 30×30 target. Exactly 892 visual samples drive 892 leaky spiking units. Brightness, contrast, temporal change, and color familiarity contribute to activity and the designed dopamine-like reward. Four normalized quadrants (upper left/right and lower left/right) determine both horizontal and vertical interest. The readback is bottom-up, so upper image rows are mapped explicitly to upward interest. Each quadrant is normalized by its actual sample count. Eleven additional tactile groups of four units represent the six legs, head, thorax, abdomen, and wings; these are proxy regions, not measured FlyEM neuron IDs. Only a compact readout has plastic weights, with dopamine-gated depression and slow recovery.

Color familiarity builds with exposure and decays over time. Repeated views therefore lose salience; unfamiliar colors and moving objects can restore novelty. The ecosystem also remembers which landscape forms the fly has recently seen and their associated sensory novelty. Offspring preferentially explore less-experienced forms, and periodic immigrants help avoid a fixed monoculture.

**This demo does not load or simulate the measured FlyEM connectome.** The 165,122 real neurons and 10,228,000 measured synapses described by [fruitflydev/flycoinrh](https://github.com/fruitflydev/flycoinrh) belong to the separate reference project. This browser demo uses a deliberately smaller model, identifies it as a proxy in the interface, and makes no claim that its reward measures pleasure. No upstream connectome data or code is bundled.

## Evolution and efficiency

A persistent 60×20 patch grid wraps in both directions. Every patch has a deterministic seed, eight species genes, a landscape grammar, elevation, roughness, color, and motion traits. The six primary ecological roles are joined by hunters and wandering flies. Canopy shelters moss, pollinators support canopy, coral feeds pollinators, grazers depend on moss, and hunters depend on prey.

Eight candidates are evaluated every 0.85 simulation seconds in the visible terrain ahead. Neighboring genes cross over and mutate. Candidates compete on diversity, mutualism, resource costs, a visual-response surrogate, recent sensory novelty, and rarity. Form mutations change object families decisively. Manual mutation introduces 20 candidates. Selection is a cheap surrogate informed by actual sensory telemetry; it does not render and simulate a separate rollout for every candidate or guarantee monotonic reward improvement.

Only chunks in the nearby view are rendered using instanced cubes and shared materials; the rotated footprint remains bounded within the 1,200-patch world. Chunk objects are recycled. The bend happens in a vertex shader. A single instanced fauna mesh draws the moving population. Terrain changes invalidate adjacent chunks because neighboring elevation genes are smoothly interpolated. Rendering resolution decreases under sustained low frame rates; paused scenes stop redundant rendering after camera settling.

Forward coordinates wrap every 960 units and lateral coordinates every 320. The default 1× is the former 4×: forward speed is 12.8 units per wall-clock second, so a straight 960-unit lap takes 75 seconds. Steering changes the route, so returning to the exact same point is not guaranteed on a timer. A radius-preserving polar twist rotates the local tangent chart, fading smoothly from radius 96 to 136, inside the torus injectivity radius of 160. It is invertible and area-preserving, then embedded on the rendered donut; it is not an isometric projection of a 4D Clifford torus. Every fresh world starts at `(12,160)`; the fly's visual response chooses its subsequent lateral path. Completed forward laps preserve its lateral position and the evolved world. Genes and exploration persist for the current browser session; refreshing resets the default seed. Reseeding restarts from the same coordinates with a new genome pool and clears the map.

## Controls

- **Arrow keys:** smoothly add attention; left/right steer, **Up dives and Down climbs**. After 0.5 seconds without arrow input, control returns to the brain; velocity eases rather than snapping.
- **Pause button:** pause/resume flight, evolution, brain steps, and soundtrack.
- **Space (unadvertised in the initial UI):** surprise arcade bursts with a narrow forward lock-on cone. Shots destroy voxel objects and carve terrain, releasing smaller cube fragments. Per-patch scars persist while revisiting and rebuilding, bounded to the latest 64 nearby blast records per patch. Creatures respawn after a delay.
- **Speed:** 1× → 2× → 4× → ½×.
- **C / camera:** follow, overlook, or fly-eye view.
- **M / Mutate:** introduce 20 new candidates ahead, including while paused.
- **Settings:** mutation strength, evolution and visual steering toggles, music volume, MIDI download, and reseeding.
- **Speaker:** mute/unmute music and ambience; some browsers require the first interaction before audio starts.
- **F / expand:** screensaver mode. **Escape** returns or closes dialogs.
- **Species:** inspect each ecological role and nearby genome share.

Hidden tabs stop simulation time and suspend audio. Music keeps its own relaxed tempo when simulation speed changes.

## Local development

Requires Node.js 20.19+ or 22.12+; deployment uses Node 24.

```sh
npm install
npm run dev
```

Open http://localhost:5173. No backend, API keys, wallet, or external brain service is needed. Fonts load from Google Fonts with system fallbacks.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run preview
```

The production build uses `/flyworld/` as its asset base; preview it at http://localhost:4173/flyworld/. `prebuild` regenerates the original MIDI from its source score. `dist` is the static deploy artifact.

## Deployment

`.github/workflows/deploy.yml` tests and builds pushes to `main`, then publishes `dist` to GitHub Pages. Pages must use **GitHub Actions** as its deployment source. The configured public URL is https://williamsharkey.github.io/flyworld/. Social preview metadata is included.

## Code

- `src/world.js`: Three.js scene, toroidal shader, fly model, altitude/camera control, and chunk streaming.
- `src/primitives.js`: twelve landscape grammars, with trees/coral built in the terrain generator.
- `src/physics.js` / `src/touch.js`: swept collisions, tactile regions, flight inertia, local chart twist, and bounded terrain damage.
- `src/controls.js`: inverted vertical attention input and automatic handoff.
- `src/transitions.js`: per-cube lifecycle scaling and bounded outgoing instances.
- `src/arcade.js`: concealed projectile bursts, limited aim assist, and voxel fragments.
- `src/ambience.js`: spatial insects, wing synchronization, water, impacts, and quiet whooshes.
- `src/fauna.js`: spatial hashing, predator pursuit, flocking, and instanced agents.
- `src/simulation.js`: genomes, terrain fields, selection, sensory familiarity, and spiking model.
- `src/exploration.js`: seam-aware path sampling, visit counts, and minimap rendering.
- `src/audio.js` / `src/score.js`: synth, original score, and Standard MIDI File export.
- `src/main.js` / `src/style.css`: simulation clock, UI, telemetry, and controls.

Model tests additionally cover quadrant direction, inverted controls and handoff, swept seam collisions, recoil, tactile region mapping, local twist inversion, persistent craters, transition timing, aim cones, and audio scheduling recovery. Model tests cover seam continuity, terrain elevation, frame-independent exploration, habituation, restoration of novelty, selection diversity, neural stability, and MIDI structure. Browser checks cover free-flight telemetry, active swaps, controls, real audio output, disclosures, and responsive layout. `window.flyworld.state` exposes read-only diagnostics.
