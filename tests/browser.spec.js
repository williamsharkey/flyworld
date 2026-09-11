import { test, expect } from "@playwright/test";

test("live world, controls, disclosures, and mobile layout work without runtime errors", async ({
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
  expect(before.patches).toBeLessThanOrEqual(1200);
  await page.locator("#mutate").click();
  const after = await page.evaluate(() => window.flyworld.state);
  expect(after.generation).toBeGreaterThan(before.generation);
  expect(after.accepted).toBe(before.accepted + 20);
  for (let i = 0; i < 3; i++) await page.locator("#camera").click();
  expect((await page.evaluate(() => window.flyworld.state)).camera).toBe(0);
  await page.locator("#speed").click();
  expect((await page.evaluate(() => window.flyworld.state)).speed).toBe(2);
  await page.locator("#settings").click();
  await page.locator("#mutation").fill("53");
  await expect(page.locator("#mutation-value")).toHaveText("53%");
  await page.locator("#evolve").uncheck();
  await page.locator("#autosteer").uncheck();
  await page.locator("#new-world").click();
  await page.locator("#settings").click();
  await page.locator("#about").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#modal-content")).toContainText(
    "does not load or simulate",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.locator('[data-species="4"]').click();
  await expect(page.locator("#modal-title")).toHaveText("Drifters");
  await page.locator("#close-modal").click();
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
    const intro = await page.locator(".intro").boundingBox(),
      side = await page.locator(".sidebar").boundingBox();
    expect(side.y).toBeGreaterThan(intro.y + intro.height);
    await expect(page.locator("#mutate")).toBeInViewport();
    await expect(page.locator("#orbit")).toBeInViewport();
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
  await expect(page.locator(".eye-quadrants span")).toHaveCount(4);
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
        u: world.u + 8,
        v: world.v,
        y: world.altitude,
        su: 2,
        sv: 10,
        sy: 12,
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
