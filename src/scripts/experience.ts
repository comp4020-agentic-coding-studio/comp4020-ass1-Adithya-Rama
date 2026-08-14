// Minimal, hand-written scene controller -- no framework, no router. The
// experience is one document; "moving forward" means swapping which .scene
// panel is visible/interactive, not a page navigation. Kept intentionally
// tiny: this is the first client-side JS in the project (see CLAUDE.md,
// "prefer the simplest architecture that satisfies the contract").
import { getBlackHole, setBlackHole, getFallProgress, setFallProgress, type BlackHoleType } from "../lib/state";
import { computeFallMetrics, formatClock, describeSignal, describeTidalStress, MAX_FALL_PROGRESS } from "../lib/fall-sim";

export function initExperience(): void {
  const root = document.querySelector<HTMLElement>('[data-testid="interaction-output"]');
  const beginButton = document.querySelector<HTMLButtonElement>('[data-testid="interaction"]');
  if (!root || !beginButton) return;

  const panels = root.querySelectorAll<HTMLElement>(".scene");

  function showScene(scene: string): void {
    if (!root) return;
    root.dataset.scene = scene;
    panels.forEach((panel) => {
      const isActive = panel.classList.contains(`scene-${scene}`);
      panel.setAttribute("aria-hidden", String(!isActive));
      if (isActive) {
        panel.removeAttribute("inert");
      } else {
        panel.setAttribute("inert", "");
      }
    });

    // Move focus into the new scene so keyboard and screen-reader users get
    // an explicit cue that the view changed -- nothing else announces it,
    // since there's no page load/title change to rely on.
    const heading = root.querySelector<HTMLElement>(`.scene-${scene} h1, .scene-${scene} h2`);
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }

  beginButton.addEventListener("click", () => showScene("selecting"));

  const blackHoleInputs = root.querySelectorAll<HTMLInputElement>('input[name="blackhole"]');
  const startDescentButton = root.querySelector<HTMLButtonElement>("#start-descent");
  const descentSummary = root.querySelector<HTMLElement>("#descent-summary");

  const choiceCopy: Record<BlackHoleType, string> = {
    stellar: "You have chosen the stellar black hole. Tidal forces here are extreme.",
    supermassive: "You have chosen the supermassive black hole. Tidal forces here are much milder.",
  };

  blackHoleInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      const choice: BlackHoleType = input.value === "supermassive" ? "supermassive" : "stellar";
      setBlackHole(choice);
      if (startDescentButton) startDescentButton.disabled = false;
    });
  });

  startDescentButton?.addEventListener("click", () => {
    const choice = getBlackHole();
    if (descentSummary && choice) {
      descentSummary.textContent = choiceCopy[choice];
    }
    showScene("syncing");
  });

  // -- clock synchronisation: both clocks snap to the same value on demand.
  // No ticking, no divergence here -- that only starts once descent begins.
  const syncStage = root.querySelector<HTMLElement>(".sync-stage");
  const syncButton = root.querySelector<HTMLButtonElement>("#sync-clocks");
  const beginDescentButton = root.querySelector<HTMLButtonElement>("#begin-descent");
  const syncStatus = root.querySelector<HTMLElement>("#sync-status");
  const clockYou = root.querySelector<HTMLElement>("#clock-you");
  const clockEarth = root.querySelector<HTMLElement>("#clock-earth");

  syncButton?.addEventListener("click", () => {
    if (clockYou) clockYou.textContent = "00:00:00";
    if (clockEarth) clockEarth.textContent = "00:00:00";
    syncStage?.classList.add("synced");
    if (syncStatus) syncStatus.textContent = "Both clocks synchronised at 00:00:00.";
    syncButton.hidden = true;
    if (beginDescentButton) beginDescentButton.hidden = false;
  });

  // -- the fall itself: a single normalized progress number (0..MAX_FALL_PROGRESS)
  // drives every derived readout. Held in state.ts, not local scope, so a
  // viewport resize can never disturb it.
  const HORIZON_ZONE_START = 0.7;
  const DESCEND_RATE_PER_SECOND = 0.1;

  const descendControl = root.querySelector<HTMLButtonElement>("#descend-control");
  const fallStatus = root.querySelector<HTMLElement>("#fall-status");
  const fallClockYou = root.querySelector<HTMLElement>("#fall-clock-you");
  const fallClockEarth = root.querySelector<HTMLElement>("#fall-clock-earth");
  const fallReadoutYou = root.querySelector<HTMLElement>("#fall-readout-you");
  const fallReadoutEarth = root.querySelector<HTMLElement>("#fall-readout-earth");
  const fallCaption = root.querySelector<HTMLElement>("#fall-caption");
  const timelineSteps = root.querySelectorAll<HTMLElement>(".fall-timeline-step");

  function renderFall(progress: number): void {
    if (!root) return;
    const metrics = computeFallMetrics(progress, getBlackHole());
    setFallProgress(metrics.progress);

    if (fallClockYou) fallClockYou.textContent = formatClock(metrics.properTimeSeconds);
    if (fallClockEarth) fallClockEarth.textContent = formatClock(metrics.observedTimeSeconds);
    if (fallReadoutYou) {
      fallReadoutYou.textContent = `Distance to horizon: ${metrics.distanceToHorizonPercent}%`;
    }
    if (fallReadoutEarth) {
      fallReadoutEarth.textContent = `Signal: ${describeSignal(metrics.signalStrength)}`;
    }
    if (fallCaption) {
      fallCaption.textContent = `Redshift ×${metrics.redshiftFactor.toFixed(1)} · Tidal stress: ${describeTidalStress(metrics.tidalStress)}`;
    }

    root.style.setProperty("--fall-lensing", String(metrics.lensingIntensity));
    root.style.setProperty("--fall-warmth", String(Math.min(1, (metrics.redshiftFactor - 1) / 3)));
    root.style.setProperty("--fall-brightness", String(metrics.observerBrightness));
    root.style.setProperty("--fall-motion-blur", `${(metrics.apparentVelocity * 2).toFixed(2)}px`);

    const stage = metrics.progress >= HORIZON_ZONE_START ? "horizon" : "approach";
    timelineSteps.forEach((step) => {
      const isActive = step.dataset.stage === stage;
      const isComplete = stage === "horizon" && step.dataset.stage === "approach";
      step.classList.toggle("is-active", isActive);
      step.classList.toggle("is-complete", isComplete);
      if (isActive) {
        step.setAttribute("aria-current", "step");
      } else {
        step.removeAttribute("aria-current");
      }
    });

    if (descendControl && metrics.progress >= MAX_FALL_PROGRESS) {
      descendControl.disabled = true;
      descendControl.textContent = "At the threshold";
    }
  }

  let holding = false;
  let lastFrameTime: number | null = null;
  let frameHandle = 0;

  function step(timestamp: number): void {
    if (!holding) return;
    if (lastFrameTime !== null) {
      const deltaSeconds = (timestamp - lastFrameTime) / 1000;
      renderFall(getFallProgress() + deltaSeconds * DESCEND_RATE_PER_SECOND);
    }
    lastFrameTime = timestamp;
    if (getFallProgress() >= MAX_FALL_PROGRESS) {
      stopHold();
      return;
    }
    frameHandle = requestAnimationFrame(step);
  }

  function startHold(): void {
    if (holding || getFallProgress() >= MAX_FALL_PROGRESS) return;
    holding = true;
    lastFrameTime = null;
    descendControl?.setAttribute("aria-pressed", "true");
    if (fallStatus) fallStatus.textContent = "Descending.";
    frameHandle = requestAnimationFrame(step);
  }

  function stopHold(): void {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(frameHandle);
    descendControl?.setAttribute("aria-pressed", "false");
    if (fallStatus) {
      fallStatus.textContent =
        getFallProgress() >= MAX_FALL_PROGRESS ? "Holding at the threshold." : "Holding position.";
    }
  }

  descendControl?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startHold();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
    descendControl?.addEventListener(name, () => stopHold());
  });

  window.addEventListener("keydown", (event) => {
    if (root.dataset.scene !== "falling") return;
    if (event.code !== "ArrowDown" && event.code !== "KeyS") return;
    if (event.repeat) return;
    event.preventDefault();
    startHold();
  });
  window.addEventListener("keyup", (event) => {
    if (event.code !== "ArrowDown" && event.code !== "KeyS") return;
    stopHold();
  });

  beginDescentButton?.addEventListener("click", () => {
    renderFall(getFallProgress());
    showScene("falling");
  });
}

initExperience();
