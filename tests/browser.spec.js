import { test, expect } from "@playwright/test";

test("minimal UI, live world, controls, audio, and mobile layout work without runtime errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.flyworld?.state.time > 0);
  await page.locator("#loading").waitFor({ state: "hidden" });
  await page.waitForFunction(() => window.flyworld.state.swaps > 0);
  // Reproduce a browser-blocked context: the first speaker click must enable it.
  await page.evaluate(async () => {
    const { synth } = window.flyworld.testing;
    await synth.ctx.suspend();
    synth.master.gain.cancelScheduledValues(synth.ctx.currentTime);
    synth.master.gain.setValueAtTime(0, synth.ctx.currentTime);
  });
  await page.locator("#sound").click();
  await page.waitForFunction(() => window.flyworld.state.music.masterGain > .1 && window.flyworld.state.music.rms > .001);
  expect((await page.evaluate(() => window.flyworld.state.music)).enabled).toBe(true);

  const flying = await page.evaluate(() => window.flyworld.state);
  expect(flying.observer).toBe("flying-observer");
  expect(flying.creatures).toBe(90);
  expect(flying.forms).toBe(12);
  expect(flying.coverage).toBeGreaterThan(0);
  expect(flying.altitude).toBeGreaterThan(flying.ground);
  await page.locator("#pause").click();
  const before = await page.evaluate(() => window.flyworld.state);
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.flyworld.state)).time).toBe(
    before.time,
  );
  expect(before.voxels).toBeGreaterThan(1000);
  const lighting = await page.evaluate(() => {
    const { world } = window.flyworld.testing;
    const sun = world.sun.position.clone().sub(world.observer.position).normalize();
    const light = world.sunLight.position.clone().sub(world.sunLight.target.position).normalize();
    return { alignment: sun.dot(light), shadows: world.renderer.shadowMap.enabled,
      correctDepth: [...world.chunks.values()].every(m => m.customDepthMaterial === world.depthMaterial) };
  });
  expect(lighting.alignment).toBeCloseTo(1, 8);
  expect(lighting.shadows && lighting.correctDepth).toBe(true);

  expect(before.patches).toBeLessThanOrEqual(1200);
  await page.locator("#mutate").click();
  const after = await page.evaluate(() => window.flyworld.state);
  expect(after.generation).toBeGreaterThan(before.generation);
  expect(after.accepted).toBe(before.accepted + 20);
  for (let i = 0; i < 3; i++) await page.locator("#camera").click();
  expect((await page.evaluate(() => window.flyworld.state)).camera).toBe(0);
  await expect(page.locator("#speed")).toHaveCount(0);
  await expect(page.locator("#neural-hud")).toBeVisible();
  await expect(page.locator(".eye-quadrants span")).toHaveCount(4);
  expect(Number(await page.locator("#interest-0").getAttribute("data-activation"))).toBeGreaterThanOrEqual(0);
  await expect(page.locator("#spike-rate")).toHaveText(/\d+/);
  expect((await page.evaluate(() => window.flyworld.state)).speed).toBe(0.5);
  await page.locator("#settings").click();
  await page.locator("#mutation").fill("53");
  await expect(page.locator("#mutation-value")).toHaveText("53%");
  await page.locator("#evolve").uncheck();
  await page.locator("#autosteer").uncheck();
  await page.locator("#new-world").click();
  await page.locator("#settings").click();
  await expect(
    page.locator("header,.intro,.sidebar,.ecosystem,.world-stats,.corner-note"),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /world worth watching|proxy|inspired by|built with/i,
  );
  await page.locator("#immersive").click();
  await expect(page.locator("body")).toHaveClass("immersive");
  await page.locator("#exit-immersive").click();
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#pause").click();
  await page.waitForFunction(
    () => window.flyworld.state.music.rms > 0.0001,
    {},
    { timeout: 12000 },
  );
  const audio = await page.evaluate(() => window.flyworld.state.music);
  expect(audio.scheduled).toBeGreaterThan(0);
  expect(audio.context).toBe("running");
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#pause").click();
  await page.screenshot({ path: "test-results/desktop.png" });
  for (const width of [390, 414]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("#mutate")).toBeInViewport();
    await expect(page.locator("#orbit")).toBeInViewport();
    await expect(page.locator("#neural-hud")).toBeInViewport();
  }
  await page.screenshot({ path: "test-results/mobile.png" });
  expect(errors).toEqual([]);
});

test("quadrants, inverted flight controls, tactile collisions, and the hidden arcade work together", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#loading").waitFor({ state: "hidden" });
  expect(await page.locator("#arcade-reticle").count()).toBe(0);
  expect(
    (await page.evaluate(() => window.flyworld.state)).quadrants,
  ).toHaveLength(4);
  await page.locator("#settings").click();
  await page.locator("#evolve").uncheck();
  await page.locator("#autosteer").uncheck();
  await page.locator("#settings").click();
  await page.locator("#pause").click();
  // Start above all terrain so vertical direction is independent of obstacles.
  await page.evaluate(() => {
    const { world } = window.flyworld.testing;
    world.physics.altitude = world.height(world.u, world.v) + 27;
    world.altitude = world.physics.altitude;
    world.physics.manualHeight = 20;
    world.physics.verticalVelocity = 0;
    world.physics.back = world.physics.lift = 0;
  });
  await page.locator("#pause").click();
  await page.keyboard.down("ArrowUp");
  await page.waitForFunction(
    () =>
      window.flyworld.state.manual.vertical < -0.5 &&
      window.flyworld.state.velocity < -0.3,
  );
  await page.keyboard.up("ArrowUp");
  await page.waitForFunction(() => window.flyworld.state.manual.mix === 0);
  await page.keyboard.down("ArrowDown");
  await page.waitForFunction(
    () =>
      window.flyworld.state.manual.vertical > 0.5 &&
      window.flyworld.state.velocity > 0.3,
  );
  await page.keyboard.up("ArrowDown");
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(() => window.flyworld.state.manual.bias > 0.4);
  const heading = (await page.evaluate(() => window.flyworld.state)).heading;
  await page.waitForFunction(
    (h) => window.flyworld.state.heading > h + 0.1,
    heading,
  );
  await page.keyboard.up("ArrowRight");
  await page.waitForFunction(() => window.flyworld.state.manual.mix === 0);
  await page.waitForFunction(
    () =>
      window.flyworld.state.music.scheduled > 0 &&
      window.flyworld.state.music.rms > 0.0001,
  );
  await page.locator("#pause").click();
  // Inject a known wall immediately ahead; exercise the real update/event path.
  const touches = await page.evaluate(() => {
    const { world, brain } = window.flyworld.testing,
      p = world.physics;
    p.heading = world.heading = 0;
    p.back = p.lift = 0;
    p.cooldown = 0;
    p.phaseUntil = -Infinity;
    world.collisions.replace("fixture", [
      {
        u: world.u + 1.9,
        v: world.v,
        y: world.altitude,
        su: 1,
        sv: 10,
        sy: 12,
        kind: 1,
        color: "#ccc",
        owner: "fixture",
      },
    ]);
    return brain.touchCount;
  });
  await page.locator("#pause").click();
  await page.waitForFunction(
    (n) => window.flyworld.state.touchCount > n,
    touches,
  );
  await page.locator("#pause").click();
  await page.evaluate(() => {
    const { world } = window.flyworld.testing;
    world.collisions.remove("fixture");
    world.physics.heading = world.heading = 0;
    world.physics.back = world.physics.lift = 0;
    world.collisions.replace("target", [
      {
        u: world.u + 20,
        v: world.v,
        y: world.altitude,
        su: 2,
        sv: 10,
        sy: 40,
        kind: 1,
        color: "#ccc",
        owner: "target",
      },
    ]);
  });
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () =>
      window.flyworld.state.shots >= 3 && window.flyworld.state.destroyed > 0,
  );
  await expect(page.locator("#arcade-reticle")).toBeAttached();
  expect((await page.evaluate(() => window.flyworld.state)).paused).toBe(false);
  await page.evaluate(() =>
    window.flyworld.testing.world.collisions.remove("target"),
  );
  expect(errors).toEqual([]);
});

test("only firing starts bass; sustained firing unlocks the chant and the reticle fades", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#loading").waitFor({ state: "hidden" });
  await page.locator("#settings").click();
  await page.locator("#evolve").uncheck();
  await page.locator("#autosteer").uncheck();
  await page.locator("#settings").click();
  await page.waitForFunction(
    () => window.flyworld.state.music.context === "running",
  );
  await page.evaluate(() => {
    const { world, synth } = window.flyworld.testing;
    world.physics.altitude = world.altitude = 45;
    world.physics.manualHeight = 24;
    world.height = () => 20; // clear air for sustained firing; no landscape changes.
    const p = { u: world.u, v: world.v, y: world.altitude };
    synth.event({ type: "contact", ...p }, world);
    synth.event({ type: "explosion", ...p }, world);
  });
  expect(
    (await page.evaluate(() => window.flyworld.state.music.combat)).active,
  ).toBe(false);
  await page.keyboard.down("Space");
  await page.waitForFunction(
    () => window.flyworld.state.music.combat.rms > 0.02,
  );
  const initial = await page.evaluate(() => window.flyworld.state.music.combat);
  expect(initial.active).toBe(true);
  expect(initial.chanting).toBe(false);
  expect(initial.voiceWords).toBe(0);
  expect(initial.acid.active).toBe(false);
  await page.waitForFunction(
    () =>
      window.flyworld.state.music.combat.acid.active &&
      window.flyworld.state.music.combat.acid.rms > 0.005,
    {},
    { timeout: 20000 },
  );
  const acid = await page.evaluate(
    () => window.flyworld.state.music.combat.acid,
  );
  expect(acid.notes).toBeGreaterThan(0);
  expect(acid.volume).toBe(0.7);
  await page.waitForFunction(
    () =>
      window.flyworld.state.music.combat.acid.slides > 0 &&
      window.flyworld.state.music.combat.acid.ties > 0,
  );
  expect(
    (await page.evaluate(() => window.flyworld.state)).speed,
  ).toBeGreaterThan(3.5);
  await page.waitForFunction(
    () =>
      window.flyworld.state.music.combat.voiceWords >= 3 &&
      window.flyworld.state.music.combat.voiceRms > 0.005,
    {},
    { timeout: 20000 },
  );
  await page.waitForFunction(
    () => window.flyworld.state.music.combat.voiceWords >= 8 &&
      window.flyworld.state.music.combat.voiceRms > 0.005,
    {}, { timeout: 12000 },
  );
  expect((await page.evaluate(() => window.flyworld.state.music.combat)).voiceVolume).toBeCloseTo(0.385);
  await page.keyboard.up("Space");
  await page.waitForFunction(
    () => !document.getElementById("arcade-reticle"),
    {},
    { timeout: 8000 },
  );
  await page.waitForFunction(
    () =>
      !window.flyworld.state.music.combat.active &&
      window.flyworld.state.speed < 1.3,
    {},
    { timeout: 8000 },
  );
  expect(errors).toEqual([]);
});

test("environment renders audible wing buzz, insects, passing objects and water", async ({ page }) => {
  await page.route("**/audio-check", route => route.fulfill({ contentType: "text/html", body: '<button id="start">Start</button>' }));
  await page.goto('/audio-check');
  await page.click('#start');
  const result = await page.evaluate(async () => {
    const { Ambience } = await import('/src/ambience.js');
    const { Vector3 } = await import('/node_modules/three/build/three.module.js');
    const ctx = new AudioContext(); await ctx.resume();
    const destination = ctx.createGain(); destination.gain.value = .425; destination.connect(ctx.destination);
    const sound = new Ambience(ctx, destination);
    const world = { u:0, v:0, altitude:10, heading:0, simTime:0, wingPhase:0,
      physics: {distance:0, back:0}, observer:{position:new Vector3(0,10,0)},
      fauna:{agents:[{u:2,v:-4,altitude:10,kind:1,visible:true,phase:0},{u:3,v:5,altitude:10,kind:2,visible:true,phase:1}]},
      project:(u,v,y)=>new Vector3(v,y,-u), height:()=>-3,
      collisions:{ candidates:()=>new Set([{u:1,v:4,y:10,kind:1}]) } };
    let peak=0;
    for(let i=0;i<20;i++) {
      world.simTime+=.08; world.wingPhase+=.08*Math.PI*22; world.physics.distance+=.5;
      sound.update(world,.4); await new Promise(r=>setTimeout(r,40)); peak=Math.max(peak,sound.rms);
    }
    const state={...sound.state, peak, left:sound.insects[0].pan.pan.value,right:sound.insects[1].pan.pan.value};
    await ctx.close(); return state;
  });
  expect(result.insects).toBe(2);
  expect(result.left).toBeLessThan(0); expect(result.right).toBeGreaterThan(0);
  expect(result.passbys).toBeGreaterThan(0); expect(result.bubbles).toBeGreaterThan(0);
  expect(result.peak).toBeGreaterThan(.005); expect(result.ownGain).toBeGreaterThan(.015);
});

test("music and bass initialize when cancelAndHoldAtTime is unavailable", async ({page})=>{
 await page.route('**/compat-audio',r=>r.fulfill({contentType:'text/html',body:'<button>Start</button>'}));
 await page.goto('/compat-audio');await page.click('button');
 const result=await page.evaluate(async()=>{
   Object.defineProperty(AudioParam.prototype,'cancelAndHoldAtTime',{value:undefined,configurable:true});
   const {DreamSynth}=await import('/src/audio.js');const synth=new DreamSynth();
   await synth.arm();
   synth.combat.trigger();synth.combat.startedAt=synth.ctx.currentTime-9;synth.combat.schedule();
   let peak = 0;
   for (let i = 0; i < 20; i++) { await new Promise(r=>setTimeout(r,100)); peak = Math.max(peak, synth.state.rms); }
   const result={rms:peak,context:synth.state.context,notes:synth.scheduled,acid:synth.combat.acid.notes};
   clearInterval(synth.timer);clearTimeout(synth.sleepTimer);await synth.ctx.close();return result;
 });
 expect(result.context).toBe('running');expect(result.rms).toBeGreaterThan(.001);
 expect(result.notes).toBeGreaterThan(0);expect(result.acid).toBeGreaterThan(0);
});

test("neural vocal atlas plays both families with the 55 percent gain reduction", async ({page}) => {
  await page.route('**/vocal-check', r => r.fulfill({contentType:'text/html',body:'Audio rendering check'}));
  await page.goto('/vocal-check');
  const result = await page.evaluate(async () => {
    const {RobotVoice} = await import('/src/robot-voice.js');
    const render = async (gain = null) => {
      const ctx = new OfflineAudioContext(1, 24000 * 8, 24000);
      const voice = new RobotVoice(ctx, ctx.destination);
      await voice.load();
      if (!voice.ready) throw new Error(voice.error);
      if (gain !== null) voice.gain.gain.value = gain;
      voice.line('0-verse-00', 0);
      voice.line('1-verse-00', 4);
      const audio = await ctx.startRendering(), data = audio.getChannelData(0);
      const rms = (start, end) => Math.sqrt(data.slice(start * 24000, end * 24000).reduce((s, v) => s + v * v, 0) / ((end - start) * 24000));
      return {first: rms(0, 3.2), second: rms(4, 7.2), engine: voice.manifest.engine, lines: voice.lines};
    };
    return {current: await render(), reference: await render(1.4 * .7)};
  });
  expect(result.current.engine).toContain('Kokoro');
  expect(result.current.lines).toBe(2);
  expect(result.current.first).toBeGreaterThan(.01);
  expect(result.current.second).toBeGreaterThan(.01);
  expect(result.current.first / result.reference.first).toBeCloseTo(.55, 5);
  expect(result.current.second / result.reference.second).toBeCloseTo(.55, 5);
});
