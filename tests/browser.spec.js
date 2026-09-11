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
  await page.locator("#sound").click();
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
