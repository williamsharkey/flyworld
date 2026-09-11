# Flyworld

A living Three.js screensaver: a fruit fly explores a toroidal voxel world that evolves to surprise its visual system.

**[Run Flyworld](https://williamsharkey.github.io/flyworld/)** · [Source](https://github.com/williamsharkey/flyworld)

The screen contains the world, compact controls, a translucent exploration map, and a compact neural HUD. The HUD shows live visual activations, the actual eye image, four quadrant values, directional attention, spikes, dopamine, novelty, histories, and tactile spikes. Branding, credits, taglines, and explanatory prose stay out of the interface.

No installation is needed to play. Every visitor gets an independent simulation in their browser.

## What happens

- **Natural flight:** a segmented fly with veined, translucent wings flaps, banks, pitches, and gently bobs. It anticipates terrain rises and climbs above them. Smooth attention changes steer and climb. Beyond ±4% steering bias, the surface pivots under the fly, with a gentle camera catch-up. A 14-unit forward distance probe eases the fly above nearby obstacles. Eleven swept body/leg/wing probes detect contact and excite 44 region-specific tactile proxy neurons. Contact gently slows forward motion, adds a small upward nudge and a decaying altitude offset, then allows 0.9 real seconds of passage through objects to prevent pinning. Upward impulses are limited to one every 0.875 real seconds. Three contacts within two real seconds enable obstacle clearance. A stronger recovery impulse is bounded to 4.8 and can occur only once every ten real seconds; it never increases the altitude target or stacks on landing contacts.
- **Twelve landscape grammars:** amber groves, coral gardens, crystal fans, giant mushrooms, stone arches, floating islands, spiral towers, flower meadows, basalt pillars, reed marshes, luminous rings, and branching ruins. Whole patches can change form. Individual incoming and outgoing cubes grow or shrink around their own centers with a 0.4-second smoothstep, timed independently of simulation speed. Unchanged cubes retain their identity. GPU attributes animate the scale; a bounded instanced batch holds outgoing cubes. Colliders follow the animated sizes. Tiny deterministic size offsets separate overlapping decorative faces.
- **Active fauna:** 90 bounded agents include hunters, flocking flies, grazers, pollinators, surface skimmers, and drifting insects. Hunters pursue nearby prey; flies separate, align, and flee. A periodic spatial hash limits neighbor searches. These are stylized ecological behaviors, not a biological predator model.
- **Persistent topography:** seeded elevation and roughness are frozen when a patch is created. Continuous periodic terrain is quantized into voxel steps and stays in place as objects evolve. Ground colors and cube identities persist through patch rebuilds. Only projectile scars and reseeding change the underlying land. Terrain below a common water level forms rivers and pools; elevated regions become hills and rocky peaks. Water has animated ripples. Water is a level-set surface, not a fluid or erosion simulation.
- **Sun and shadows:** one fixed celestial direction is transformed into the recentered torus frame, including steering and both wrapped coordinates. The sun disc, halo, directional light, and shadows share that direction. Flat-shaded normals follow the deformed voxel faces. Nearby chunks cast 1024-pixel soft shadows through the same torus and lifecycle shader used by the visible geometry. The sky and indirect light shift gently through daylight and dusk.
- **Flight memory:** a minimap shows the entire unwrapped torus. Visited cells appear translucent; additional crossings make them more opaque. The percentage is unique 4×4-unit cells visited out of 19,200. The map interpolates movement across both seams, and hovering does not add visits.
- **Original evolving music:** *Wandering Light* and *Neon Monsoon* blend continuously over a 16-minute, ten-movement cycle. The quiet arrangement runs at 75 BPM with soft disco pulses, evolving pads, plucks, bell phrases, and glides; the firing arrangement doubles the pulse to 150 BPM. Both follow the same musical clock and pitch palettes. Pad voices renew individually instead of changing whole chords on bar lines. Seeded, slowly wandering probabilities alter hits, rests, melodic choices, and acid ornaments. A deterministic five-track MIDI snapshot is available in Settings; live playback generates new windows continuously.
- **Environmental sound:** eight nearby insect voices have distance attenuation, filtering, stereo placement, Doppler pitch, and flutter modulation. The fly has a stronger wing-synchronized buzz; airflow rises with speed and banks with steering. Nearby objects produce bounded spatial pass-by sweeps. Nearby water produces panned flowing noise and randomized bubbling. Impacts and voxel rearrangements add spatial transients. Environmental audio has its own bus and remains present during both song families. Audio unlocks automatically when allowed or on the first interaction, with a gentle fade-in. The master gain is armed before awaiting browser audio resume; a first speaker click enables a blocked context instead of muting it. An automation fallback supports browsers without `cancelAndHoldAtTime`.

## The brain is an explicit proxy

The eye camera renders the actual scene to a 30×30 target. Exactly 892 visual samples drive 892 leaky spiking units. Brightness, contrast, temporal change, and color familiarity contribute to activity and the designed dopamine-like reward. Four normalized quadrants (upper left/right and lower left/right) determine both horizontal and vertical interest. The readback is bottom-up, so upper image rows are mapped explicitly to upward interest. Each quadrant is normalized by its actual sample count. Eleven additional tactile groups of four units represent the six legs, head, thorax, abdomen, and wings; these are proxy regions, not measured FlyEM neuron IDs. Only a compact readout has plastic weights, with dopamine-gated depression and slow recovery.

Color familiarity builds with exposure and decays over time. Repeated views therefore lose salience; unfamiliar colors and moving objects can restore novelty. The ecosystem also remembers which landscape forms the fly has recently seen and their associated sensory novelty. Offspring preferentially explore less-experienced forms, and periodic immigrants help avoid a fixed monoculture.

**This demo does not load or simulate the measured FlyEM connectome.** The 165,122 real neurons and 10,228,000 measured synapses described by [fruitflydev/flycoinrh](https://github.com/fruitflydev/flycoinrh) belong to the separate reference project. This browser demo uses a deliberately smaller model, documents its proxy model here, and makes no claim that its reward measures pleasure. No upstream connectome data or code is bundled.

## Evolution and efficiency

A persistent 60×20 patch grid wraps in both directions. Every patch has a deterministic seed, eight species genes, a landscape grammar, elevation, roughness, color, and motion traits. The six primary ecological roles are joined by hunters and wandering flies. Canopy shelters moss, pollinators support canopy, coral feeds pollinators, grazers depend on moss, and hunters depend on prey.

Eight candidates are evaluated every 0.85 simulation seconds in the visible terrain ahead. Neighboring genes cross over and mutate. Candidates compete on diversity, mutualism, resource costs, a visual-response surrogate, recent sensory novelty, and rarity. Form mutations change object families decisively. Manual mutation introduces 20 candidates. Selection is a cheap surrogate informed by actual sensory telemetry; it does not render and simulate a separate rollout for every candidate or guarantee monotonic reward improvement.

Only chunks in the nearby view are rendered using instanced cubes and shared materials; the rotated footprint remains bounded within the 1,200-patch world. Chunk objects are recycled. The bend happens in a vertex shader. A single instanced fauna mesh draws the moving population. Evolution rebuilds only changed patches. Distant chunks extend the horizon with ground and water only; nearby chunks add evolving objects. Rendering resolution decreases under sustained low frame rates; paused scenes stop redundant rendering after camera settling.

Forward coordinates wrap every 960 units and lateral coordinates every 320. Flight starts at half the former default speed: 6.4 units per real second. Firing smoothly accelerates toward four times that former default, 51.2 units per second; releasing fire eases back toward 6.4. A critically damped controller retains velocity through input changes, reaches about 99% of the firing target after eight seconds, and settles back over several seconds. There is no manual speed selector. The automatic pace works with audio muted. Straight laps therefore range from 150 seconds at rest to 18.75 seconds at maximum firing speed. Steering changes the route, so returning to the exact same point is not guaranteed on a timer. A radius-preserving polar twist rotates the local tangent chart, fading smoothly from radius 96 to 136, inside the torus injectivity radius of 160. It is invertible and area-preserving, then embedded on the rendered donut; it is not an isometric projection of a 4D Clifford torus. Every fresh world starts at `(12,160)`; the fly's visual response chooses its subsequent lateral path. Completed forward laps preserve its lateral position and the evolved world. Genes and exploration persist for the current browser session; refreshing resets the default seed. Reseeding restarts from the same coordinates with a new genome pool and clears the map.

## Controls

- **Arrow keys:** smoothly add attention; left/right steer, **Up dives and Down climbs**. After 0.5 seconds without arrow input, control returns to the brain; velocity eases rather than snapping.
- **Pause button:** pause/resume flight, evolution, brain steps, and soundtrack.
- **Space (unadvertised in the initial UI):** surprise arcade bursts with a narrow forward lock-on cone. Shots destroy voxel objects and carve terrain, releasing smaller cube fragments. The reticle begins fading two seconds after the last actual burst and disappears 0.45 seconds later. Explosions send up to 360 fragments from the destroyed voxel volumes, with radial impulses, size-dependent speed, spin, gravity, drag, swept obstacle collisions, friction, and damped bounces. Up to 2,200 debris cubes persist for 3.5–6 real seconds. Fragments do not collide with one another. Per-patch scars persist while revisiting and rebuilding, bounded to the latest 64 nearby blast records per patch. Creatures respawn after a delay.
- **Automatic speed:** relaxed half-speed flight; firing ramps toward 4× the former default. Releasing fire slows the world smoothly. Pause holds the current pace; reseeding restores the slow start.
- **C / camera:** follow, overlook, or fly-eye view.
- **M / Mutate:** introduce 20 new candidates ahead, including while paused.
- **Settings:** mutation strength, evolution and visual steering toggles, music volume, MIDI download, and reseeding.
- **Speaker:** mute/unmute music and ambience; some browsers require the first interaction before audio starts.
- **F / expand:** screensaver mode. **Escape** returns or closes dialogs.

**Firing soundtrack:** only actual Space-triggered shots activate the original 150 BPM electro / Miami-bass groove. The quiet score plays at 120% of its former gain and ducks to 12% under distorted 808 kicks, sub-bass, claps, and hats. Collision and automatic-clearance explosions never activate it. After eight seconds in a continuous firing session, a monophonic 303-style acid line joins the groove: sawtooth oscillator, resonant cascaded low-pass filters, distortion, accents, connected gates, and exponential portamento. It uses an original 32-step pattern with tied notes and slides, probabilistic ornamentation, and modal pitch mapping. Acid output is 70% of its former level. After twelve seconds, a local formant/phoneme synthesizer enters on beat two, starting with a verse and cycling through 24 original explicit fruit-fly lines, with a hook after every four lines. Each line spans two bars, with longer syllables and breathing room. Every syllable follows the drum grid. Two voices sing in unison one octave below and above the original pitch, at 70% of their previous volume. A three-second firing gap ends the session, stops the chant, and restores the ambient score; a new session restarts the twelve-second timer. No sampled artist recording, voice service, or downloaded speech model is used.

The ten pitch palettes follow the named sequence listed for [Charanjit Singh’s *Ten Ragas to a Disco Beat*](https://soundsoftheuniverse.com/sjr/product/charanjit-singh-india-1982-ten-ragas-to-a-disco-beat): Bhairav, Lalit, Bhupali, Megh Malhar, Yaman, Kalavati, Madhuvanti, Todi, Malkauns, and Bairagi. These are equal-tempered, raga-inspired constraints for original melodies, not transcriptions or a simulation of classical raga grammar. Each movement lasts 96 seconds; its final 24 seconds gradually favor the next palette. Held notes finish naturally. The two song families wax and wane inside every movement, and firing never restarts the opus clock.

Hidden tabs stop simulation time and suspend audio. Music keeps its own relaxed tempo when simulation speed changes.

## Local development

Requires Node.js 20.19+ or 22.12+; deployment uses Node 24.

```sh
npm install
npm run dev
```

Open http://localhost:5173. No backend, API keys, wallet, or external brain service is needed. The interface uses system fonts.

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
- `src/controls.js` / `src/pace.js`: inverted vertical attention, automatic handoff, and firing-driven inertial speed.
- `src/transitions.js`: per-cube lifecycle scaling and bounded outgoing instances.
- `src/arcade.js` / `src/debris.js`: concealed projectile bursts, limited aim assist, radial explosions, and ballistic fragments.
- `src/combat-audio.js` / `src/acid.js` / `src/robot-voice.js`: firing-only bass groove, delayed acid layer, ambient ducking, and timed formant-synthesized chant.
- `src/ambience.js`: spatial insects, wing synchronization, airflow, water bubbles, impacts, and pass-by sweeps.
- `src/opus.js` / `src/music-evolution.js`: shared sixteen-minute form, pitch palettes, song-family blending, and probability drift.
- `src/lighting.js`: periodic celestial direction shared by sun placement and directional shadows.
- `src/hud.js`: live visual and tactile activations, eye image, quadrant attention, and history displays.
- `src/fauna.js`: spatial hashing, predator pursuit, flocking, and instanced agents.
- `src/simulation.js`: genomes, terrain fields, selection, sensory familiarity, and spiking model.
- `src/exploration.js`: seam-aware path sampling, visit counts, and minimap rendering.
- `src/audio.js` / `src/score.js`: synth, original score, and Standard MIDI File export.
- `src/main.js` / `src/style.css`: simulation clock, UI, telemetry, and controls.

Model tests additionally cover quadrant direction, inverted controls and handoff, swept seam collisions, recoil, tactile region mapping, local twist inversion, persistent craters, transition timing, aim cones, and audio scheduling recovery. Model tests cover seam continuity, terrain elevation, frame-independent exploration, habituation, restoration of novelty, selection diversity, neural stability, and MIDI structure. Browser checks cover free-flight telemetry, active swaps, controls, real audio output, minimal UI and responsive layout. Further checks cover recovery cooldowns, radial debris and bounces, firing-only bass, the twelve-second chant gate, and reticle expiry. `window.flyworld.state` exposes read-only diagnostics.
