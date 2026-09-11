# Flyworld

A living Three.js screensaver: a fruit fly explores a toroidal voxel world that evolves to surprise its visual system.

**[Run Flyworld](https://williamsharkey.github.io/flyworld/)** · [Source](https://github.com/williamsharkey/flyworld)

No installation is needed to play. Every visitor gets an independent simulation in their browser.

## What happens

- **Natural flight:** a segmented fly with veined, translucent wings flaps, banks, pitches, and gently bobs. It anticipates terrain rises and climbs above them. The camera follows lateral choices with a 1.8-second lag, recentering the curved world beneath the fly.
- **Twelve landscape grammars:** amber groves, coral gardens, crystal fans, giant mushrooms, stone arches, floating islands, spiral towers, flower meadows, basalt pillars, reed marshes, luminous rings, and branching ruins. Whole patches can change form; there is no shrinking-tree clearance effect.
- **Active fauna:** 90 bounded agents include hunters, flocking flies, grazers, pollinators, surface skimmers, and drifting insects. Hunters pursue nearby prey; flies separate, align, and flee. A periodic spatial hash limits neighbor searches. These are stylized ecological behaviors, not a biological predator model.
- **Evolving topography:** elevation and roughness are inherited traits. Continuous periodic terrain is quantized into voxel steps. Terrain below a common water level forms rivers and pools; elevated regions become hills and rocky peaks. Water has animated ripples. Water is a level-set surface, not a fluid or erosion simulation.
- **Flight memory:** a minimap shows the entire unwrapped torus. Visited cells appear translucent; additional crossings make them more opaque. The percentage is unique 4×4-unit cells visited out of 19,200. The map interpolates movement across both seams, and hovering does not add visits.
- **Original music:** *Wandering Light*, a relaxing 72 BPM MIDI-style composition, plays through a Web Audio synth with detuned sawtooth pads, slow low-pass sweeps, stereo chorus, reverb, arpeggios, and a soft bass. The tone evokes vintage Juno/Oberheim-style textures. It is an original composition, not a transcription of *The NeverEnding Story*. Download its five-track MIDI in Settings.

## The brain is an explicit proxy

The eye camera renders the actual scene to a 30×30 target. Exactly 892 visual samples drive 892 leaky spiking units. Brightness, contrast, temporal change, and color familiarity contribute to activity and the designed dopamine-like reward. Left/right responses determine lateral steering. Only a compact readout has plastic weights, with dopamine-gated depression and slow recovery.

Color familiarity builds with exposure and decays over time. Repeated views therefore lose salience; unfamiliar colors and moving objects can restore novelty. The ecosystem also remembers which landscape forms the fly has recently seen and their associated sensory novelty. Offspring preferentially explore less-experienced forms, and periodic immigrants help avoid a fixed monoculture.

**This demo does not load or simulate the measured FlyEM connectome.** The 165,122 real neurons and 10,228,000 measured synapses described by [fruitflydev/flycoinrh](https://github.com/fruitflydev/flycoinrh) belong to the separate reference project. This browser demo uses a deliberately smaller model, identifies it as a proxy in the interface, and makes no claim that its reward measures pleasure. No upstream connectome data or code is bundled.

## Evolution and efficiency

A persistent 60×20 patch grid wraps in both directions. Every patch has a deterministic seed, eight species genes, a landscape grammar, elevation, roughness, color, and motion traits. The six primary ecological roles are joined by hunters and wandering flies. Canopy shelters moss, pollinators support canopy, coral feeds pollinators, grazers depend on moss, and hunters depend on prey.

Eight candidates are evaluated every 0.85 simulation seconds in the visible terrain ahead. Neighboring genes cross over and mutate. Candidates compete on diversity, mutualism, resource costs, a visual-response surrogate, recent sensory novelty, and rarity. Form mutations change object families decisively. Manual mutation introduces 20 candidates. Selection is a cheap surrogate informed by actual sensory telemetry; it does not render and simulate a separate rollout for every candidate or guarantee monotonic reward improvement.

Only 99 nearby terrain chunks are rendered using instanced cubes and shared materials. Chunk objects are recycled. The bend happens in a vertex shader. A single instanced fauna mesh draws the moving population. Terrain changes invalidate adjacent chunks because neighboring elevation genes are smoothly interpolated. Rendering resolution decreases under sustained low frame rates; paused scenes stop redundant rendering after camera settling.

Forward coordinates wrap every 960 units and lateral coordinates every 320. A forward lap takes five simulation minutes at 1×. The visible surface is a recentered toroidal chart, not an isometric projection of a 4D Clifford torus. Every fresh world starts at `(12,160)`; the fly's visual response chooses its subsequent lateral path. Completed forward laps preserve its lateral position and the evolved world. Genes and exploration persist for the current browser session; refreshing resets the default seed. Reseeding restarts from the same coordinates with a new genome pool and clears the map.

## Controls

- **Space:** pause/resume flight, evolution, brain steps, and soundtrack.
- **Speed:** 1× → 2× → 4× → ½×.
- **C / camera:** follow, overlook, or fly-eye view.
- **M / Mutate:** introduce 20 new candidates ahead, including while paused.
- **Settings:** mutation strength, evolution and visual steering toggles, music volume, MIDI download, and reseeding.
- **Speaker:** opt into the synth soundtrack; browsers require a user gesture for audio.
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
- `src/fauna.js`: spatial hashing, predator pursuit, flocking, and instanced agents.
- `src/simulation.js`: genomes, terrain fields, selection, sensory familiarity, and spiking model.
- `src/exploration.js`: seam-aware path sampling, visit counts, and minimap rendering.
- `src/audio.js` / `src/score.js`: synth, original score, and Standard MIDI File export.
- `src/main.js` / `src/style.css`: simulation clock, UI, telemetry, and controls.

Model tests cover seam continuity, terrain elevation, frame-independent exploration, habituation, restoration of novelty, selection diversity, neural stability, and MIDI structure. Browser checks cover free-flight telemetry, active swaps, controls, real audio output, disclosures, and responsive layout. `window.flyworld.state` exposes read-only diagnostics.
