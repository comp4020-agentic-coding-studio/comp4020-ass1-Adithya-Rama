import { test, expect, type Page } from "@playwright/test";

// End-to-end checks for the experience's core contract (see CLAUDE.md /
// PROMPT 20). These exercise what spec/*.test.ts (jsdom against the built
// HTML) can't: real timers, pointer holds, and the scene-swapping driven by
// src/scripts/experience.ts. Reduced motion is forced so the scripted
// crossing/escape sequences resolve in ~0.5s instead of ~3.2s.
test.use({ contextOptions: { reducedMotion: "reduce" } });

const MAX_FALL_PROGRESS = 0.94; // must match src/lib/fall-sim.ts
const DESCEND_RATE_PER_SECOND = 0.1; // must match src/scripts/experience.ts

// Holds the descend control for a given duration, the same pointerdown/
// pointerup pair the control itself listens for -- dispatched directly
// rather than via a real mouse hover so the gesture behaves identically
// under both the desktop and the touch-emulated mobile project.
async function holdDescend(page: Page, seconds: number): Promise<void> {
  const control = page.locator("#descend-control");
  await control.dispatchEvent("pointerdown");
  await page.waitForTimeout(seconds * 1000);
  await control.dispatchEvent("pointerup");
}

async function chooseBlackHole(page: Page, value: "stellar" | "supermassive"): Promise<void> {
  await page.locator(`#blackhole-${value}`).check({ force: true });
}

async function reachHorizonAndSeeOutcome(page: Page): Promise<string> {
  // Enough real holding to clamp progress at MAX_FALL_PROGRESS, plus margin
  // against CI timer jitter.
  await holdDescend(page, Math.ceil(MAX_FALL_PROGRESS / DESCEND_RATE_PER_SECOND) + 1);
  await page.locator("#descend-control").click(); // one-shot: crossing or tidal breakup
  await expect(page.locator("#horizon-crossed-panel")).toHaveAttribute("aria-hidden", "false");

  const root = page.getByTestId("interaction-output");
  const blackHole = await root.getAttribute("data-blackhole");
  if (blackHole === "stellar") {
    await expect(root).toHaveAttribute("data-fate", "tidal-breakup");
    await expect(page.locator("#horizon-crossed-heading")).toHaveText("Tidal breakup");
    await expect(page.locator("#fall-clock-you")).toContainText("disrupted");
    await expect(page.locator(".stellar-fate-visual")).toBeVisible();
    await expect(page.locator(".trajectory-stage")).toBeHidden();
    await expect(page.getByTestId("escape-control")).toHaveText("Resolve final light");
  } else {
    await expect(root).toHaveAttribute("data-fate", "intact-crossing");
    await expect(page.locator("#horizon-crossed-heading")).toHaveText("Horizon crossed");
    await expect(page.locator("#fall-clock-you")).not.toContainText("disrupted");
    await expect(page.locator(".stellar-fate-visual")).toBeHidden();
    await expect(page.locator(".trajectory-stage")).toBeVisible();
    await expect(page.getByTestId("escape-control")).toHaveText("Fire engines");
  }

  await page.getByTestId("escape-control").click();
  await expect(page.getByTestId("see-outcome")).toBeVisible();
  await page.getByTestId("see-outcome").click();

  return (await page.locator("#outcome-headline").textContent())?.trim() ?? "";
}

test("app loads and offers its hero call to action", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveTitle(/FALL/);
  await expect(page.getByTestId("interaction")).toBeVisible();
});

test("choosing a black hole unlocks descent; clocks sync; descending diverges them; a signal changes visible state; a resize mid-fall doesn't disrupt it", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByTestId("interaction").click();
  await expect(page.getByTestId("interaction-output")).toHaveAttribute("data-scene", "selecting");

  await expect(page.getByTestId("start-descent")).toBeDisabled();
  await chooseBlackHole(page, "stellar");
  await expect(page.getByTestId("start-descent")).toBeEnabled();

  await page.getByTestId("start-descent").click();
  await page.getByTestId("sync-clocks").click();
  await expect(page.locator("#clock-you")).toHaveText("00:00:00");
  await expect(page.locator("#clock-earth")).toHaveText("00:00:00");

  await page.getByTestId("begin-descent").click();
  await expect(page.getByTestId("interaction-output")).toHaveAttribute("data-scene", "falling");
  await expect(page.locator("#fall-readout-you")).toContainText("100%");

  await holdDescend(page, 2);
  await expect(page.locator("#fall-readout-you")).not.toContainText("100%");
  const you = await page.locator("#fall-clock-you").textContent();
  const earth = await page.locator("#fall-clock-earth").textContent();
  expect(you).not.toBe(earth);

  await page.getByTestId("send-signal").click();
  await expect(page.getByTestId("send-signal")).toBeDisabled();
  await expect(page.locator("#signal-outgoing")).toHaveText("Sending");
  await expect(page.getByTestId("send-signal")).toBeEnabled({ timeout: 5000 });
  await expect(page.locator("#signal-received")).not.toHaveText("—");

  // Resize mid-interaction: the fall must keep showing a consistent state,
  // not get stuck or reset, across a live viewport change.
  const before = await page.locator("#fall-readout-you").textContent();
  await page.setViewportSize({ width: 500, height: 900 });
  await expect(page.getByTestId("interaction-output")).toHaveAttribute("data-scene", "falling");
  await expect(page.locator("#fall-readout-you")).toHaveText(before ?? "");
});

test("the outcome (and reaching the horizon) depends on which black hole was chosen; replay resets to the start", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByTestId("interaction").click();
  await chooseBlackHole(page, "stellar");
  await page.getByTestId("start-descent").click();
  await page.getByTestId("sync-clocks").click();
  await page.getByTestId("begin-descent").click();
  const stellarHeadline = await reachHorizonAndSeeOutcome(page);

  // Only one black hole done: "see outcome" lands on the outcome scene, whose
  // CTA is "try the other black hole" -- not the comparison scene (that only
  // appears once both runs are complete, see below).
  await expect(page.getByTestId("interaction-output")).toHaveAttribute("data-scene", "outcome");
  await page.getByTestId("try-other-blackhole").click();
  await expect(page.getByTestId("interaction-output")).toHaveAttribute("data-scene", "selecting");
  await expect(page.locator("#blackhole-supermassive")).toBeChecked();
  await expect(page.getByTestId("start-descent")).toBeEnabled();

  await page.getByTestId("start-descent").click();
  await page.getByTestId("sync-clocks").click();
  await page.getByTestId("begin-descent").click();
  const supermassiveHeadline = await reachHorizonAndSeeOutcome(page);

  expect(supermassiveHeadline).not.toBe(stellarHeadline);
  expect(stellarHeadline.length).toBeGreaterThan(0);
  expect(supermassiveHeadline.length).toBeGreaterThan(0);

  // Both black holes now done: "see outcome" lands on the comparison scene,
  // whose CTA is the real replay button.
  await expect(page.getByTestId("interaction-output")).toHaveAttribute("data-scene", "comparison");
  await page.getByTestId("replay-experience").click();
  await expect(page.getByTestId("interaction-output")).toHaveAttribute("data-scene", "hero");
  await expect(page.locator('input[name="blackhole"]:checked')).toHaveCount(0);
  await expect(page.getByTestId("start-descent")).toBeDisabled();
});
