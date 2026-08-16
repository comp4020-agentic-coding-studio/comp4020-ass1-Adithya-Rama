import { test, expect, type Page } from "@playwright/test";

// End-to-end checks for the continuous descent added in the cinematic redesign.
// Kept separate from core-contract.e2e.ts, which asserts the eight-step
// interaction contract; this file covers how the visitor actually drives the
// fall (wheel, drag, keyboard, both directions) and the properties the redesign
// must not regress.
//
// Deliberately robust rather than pixel-exact: the void renderer is a
// time-evolved animation, so anything asserting an exact look would flake in
// CI. What's gated here is the behaviour -- input moves progress, frames differ
// substantially between milestones, nothing overflows, no loop leaks. The
// finer-grained "does the hole/lensing/streak energy escalate" measurements are
// diagnostic and live outside the check suite.
test.use({ contextOptions: { reducedMotion: "no-preference" } });

/** Reads the integer percent out of the YOU-side distance readout. */
async function distancePercent(page: Page): Promise<number> {
  return page.locator("#fall-readout-you").evaluate((el) => {
    const match = /(\d+)%/.exec(el.textContent ?? "");
    return match ? Number(match[1]) : Number.NaN;
  });
}

/**
 * Fall progress as a float, straight off the custom property renderFall writes.
 * Preferred over the rounded percent readout for movement assertions: under a
 * loaded CI machine two genuinely different positions can round to the same
 * whole percent, which makes strict comparisons flake.
 */
async function progress(page: Page): Promise<number> {
  return page
    .getByTestId("interaction-output")
    .evaluate((el) => Number((el as HTMLElement).style.getPropertyValue("--fall-progress")));
}

/**
 * Waits until only the named scene is painted. Unlike core-contract.e2e.ts this
 * suite runs with motion *enabled*, so scene cross-fades really do take
 * --duration-slow -- and mid-fade the outgoing panel still covers the incoming
 * one, so a click can land on the wrong scene and silently do nothing.
 */
async function sceneSettled(page: Page, scene: string): Promise<void> {
  await expect(page.getByTestId("interaction-output")).toHaveAttribute("data-scene", scene);
  await page.waitForFunction(
    (name) =>
      [...document.querySelectorAll(".scene")].every((panel) => {
        const target = panel.classList.contains(`scene-${name}`) ? 1 : 0;
        return Math.abs(Number(getComputedStyle(panel).opacity) - target) < 0.01;
      }),
    scene,
  );
}

async function gotoFalling(page: Page): Promise<void> {
  await page.goto("./");
  await sceneSettled(page, "hero");
  await page.getByTestId("interaction").click();

  await sceneSettled(page, "selecting");
  await page.locator("#blackhole-supermassive").check({ force: true });
  await expect(page.getByTestId("start-descent")).toBeEnabled();
  await page.getByTestId("start-descent").click();

  await sceneSettled(page, "syncing");
  await page.getByTestId("sync-clocks").click();
  await expect(page.getByTestId("begin-descent")).toBeVisible();
  await page.getByTestId("begin-descent").click();

  await sceneSettled(page, "falling");
  await expect(page.locator("#fall-void")).toBeVisible();
}

/** Centres the mouse over the void so wheel events land on the cockpit. */
async function overVoid(page: Page): Promise<void> {
  const box = await page.locator("#fall-void").boundingBox();
  if (!box) throw new Error("#fall-void has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/** Wheels downward until the distance readout drops to `percent` or below. */
async function descendTo(page: Page, percent: number): Promise<void> {
  await overVoid(page);
  for (let i = 0; i < 500; i += 1) {
    if ((await distancePercent(page)) <= percent) return;
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(20);
  }
  throw new Error(`never reached ${percent}%`);
}

test("the void canvas exists and is sized once the falling scene is shown", async ({ page }) => {
  await gotoFalling(page);
  const size = await page.locator("#fall-void").evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return { w: canvas.width, h: canvas.height, cssW: rect.width, cssH: rect.height };
  });
  expect(size.w).toBeGreaterThan(0);
  expect(size.h).toBeGreaterThan(0);
  expect(size.cssW).toBeGreaterThan(200);
  expect(size.cssH).toBeGreaterThan(200);
});

test("wheel and drag descend; wheel-up and Arrow Up retreat; nothing reverses past the horizon", async ({
  page,
}) => {
  await gotoFalling(page);
  expect(await progress(page)).toBe(0);

  // Generous epsilon throughout: what matters is the *direction* each input
  // moves the descent, not how far a given burst gets on a given machine.
  const EPS = 0.01;

  // Wheel down descends.
  await overVoid(page);
  for (let i = 0; i < 16; i += 1) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(24);
  }
  const afterWheelDown = await progress(page);
  expect(afterWheelDown).toBeGreaterThan(EPS);

  // Wheel up retreats -- the descent is reversible outside the horizon.
  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(24);
  }
  const afterWheelUp = await progress(page);
  expect(afterWheelUp).toBeLessThan(afterWheelDown - EPS);

  // Arrow Down / Arrow Up do the same from the keyboard alone.
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowDown");
  const afterKeyDown = await progress(page);
  expect(afterKeyDown).toBeGreaterThan(afterWheelUp + EPS);

  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowUp");
  expect(await progress(page)).toBeLessThan(afterKeyDown - EPS);

  // A downward pointer drag on the void descends.
  const beforeDrag = await progress(page);
  const box = await page.locator("#fall-void").boundingBox();
  if (!box) throw new Error("#fall-void has no box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) {
    await page.mouse.move(cx, cy + i * 20);
    await page.waitForTimeout(24);
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
  expect(await progress(page)).toBeGreaterThan(beforeDrag + EPS);

  // Past the horizon every input is refused, in both directions.
  await descendTo(page, 6);
  await page.locator("#descend-control").click();
  await expect(page.locator("#horizon-crossed-panel")).toHaveAttribute("aria-hidden", "false");
  const crossed = await progress(page);
  await overVoid(page);
  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(24);
  }
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowUp");
  expect(await progress(page)).toBe(crossed);
});

test("the infalling clock never runs backwards while retreating, though distance does", async ({
  page,
}) => {
  await gotoFalling(page);
  await descendTo(page, 55);

  const clockAtDepth = await page.locator("#fall-clock-you").textContent();
  const progressAtDepth = await progress(page);

  // Retreat: fall-sim derives proper time from *position*, so a naive reversal
  // would wind the infalling clock back. Thrusting outward still costs the
  // traveller time, so the clock must only ever advance.
  await overVoid(page);
  for (let i = 0; i < 24; i += 1) {
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(24);
  }

  expect(await progress(page)).toBeLessThan(progressAtDepth - 0.01);
  expect(await distancePercent(page)).toBeGreaterThan(55);

  const toSeconds = (clock: string | null): number => {
    const [h, m, s] = (clock ?? "00:00:00").split(":").map(Number);
    return h * 3600 + m * 60 + s;
  };
  expect(toSeconds(await page.locator("#fall-clock-you").textContent())).toBeGreaterThanOrEqual(
    toSeconds(clockAtDepth),
  );
});

test("the scene visibly changes between descent milestones, and never overflows", async ({
  page,
}) => {
  await gotoFalling(page);

  const stops = [100, 65, 30, 6];
  const shots: Buffer[] = [];
  for (const percent of stops) {
    await descendTo(page, percent);
    // Let the loop settle so the frame isn't caught mid-input.
    await page.waitForTimeout(280);
    shots.push(await page.locator(".scene-falling").screenshot());

    const overflow = await page.evaluate(() => {
      const scene = document.querySelector(".scene-falling");
      if (!scene) return null;
      const doc = document.documentElement;
      return {
        sceneX: scene.scrollWidth - scene.clientWidth,
        sceneY: scene.scrollHeight - scene.clientHeight,
        docX: doc.scrollWidth - doc.clientWidth,
        docY: doc.scrollHeight - doc.clientHeight,
      };
    });
    expect(overflow).not.toBeNull();
    expect(overflow?.sceneX).toBeLessThanOrEqual(1);
    expect(overflow?.sceneY).toBeLessThanOrEqual(1);
    expect(overflow?.docX).toBeLessThanOrEqual(1);
    expect(overflow?.docY).toBeLessThanOrEqual(1);
  }

  // A coarse whole-frame difference, deliberately not a look-specific one: this
  // exists to catch the regression where p=0 and p=0.75 rendered identical
  // backgrounds and only the digits moved.
  const differs = (a: Buffer, b: Buffer): number => {
    const length = Math.min(a.length, b.length);
    let changed = 0;
    for (let i = 0; i < length; i += 64) {
      if (a[i] !== b[i]) changed += 1;
    }
    return changed / Math.ceil(length / 64);
  };

  for (let i = 1; i < shots.length; i += 1) {
    expect(differs(shots[i - 1], shots[i])).toBeGreaterThan(0.15);
  }
  expect(differs(shots[0], shots[shots.length - 1])).toBeGreaterThan(0.3);
});

test("no animation loop survives leaving, crossing, or resetting the scene", async ({ page }) => {
  // A leaked requestAnimationFrame keeps drawing behind a hidden panel: real
  // battery cost, and a loop outliving the state it was drawing. Counted by
  // instrumenting rAF before any of the app's own scripts run.
  await page.addInitScript(() => {
    const w = window as unknown as { __rafLive: number };
    w.__rafLive = 0;
    const rawRequest = window.requestAnimationFrame.bind(window);
    const rawCancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      w.__rafLive += 1;
      return rawRequest((t) => {
        w.__rafLive -= 1;
        cb(t);
      });
    };
    window.cancelAnimationFrame = (handle: number): void => {
      w.__rafLive = Math.max(0, w.__rafLive - 1);
      rawCancel(handle);
    };
  });

  await gotoFalling(page);
  await descendTo(page, 40);

  const live = async (): Promise<number> =>
    page.evaluate(() => (window as unknown as { __rafLive: number }).__rafLive);

  // Idle in the falling scene: the renderer is running, so at most one frame is
  // outstanding at a time.
  await page.waitForTimeout(300);
  expect(await live()).toBeLessThanOrEqual(2);

  // Cross, reach the outcome, then take a reset path back out of the scene.
  // "try the other black hole" is the reset reachable from the outcome scene
  // (replay lives in the comparison scene, which needs both runs done); it
  // routes through resetRunUI(), which is what must stop the loop.
  await descendTo(page, 6);
  await page.locator("#descend-control").click();
  await expect(page.locator("#horizon-crossed-panel")).toHaveAttribute("aria-hidden", "false");
  await page.getByTestId("escape-control").click();
  await expect(page.getByTestId("see-outcome")).toBeVisible();
  await page.getByTestId("see-outcome").click();
  await sceneSettled(page, "outcome");
  await page.getByTestId("try-other-blackhole").click();
  await sceneSettled(page, "selecting");

  // Two frames' grace for anything already scheduled to drain, then nothing new
  // may be queued.
  await page.waitForTimeout(400);
  const settled = await live();
  await page.waitForTimeout(400);
  expect(await live()).toBeLessThanOrEqual(settled);
  expect(settled).toBeLessThanOrEqual(1);
});
