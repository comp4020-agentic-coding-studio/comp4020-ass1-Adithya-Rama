// Minimal, hand-written scene controller -- no framework, no router. The
// experience is one document; "moving forward" means swapping which .scene
// panel is visible/interactive, not a page navigation. Kept intentionally
// tiny: this is the first client-side JS in the project (see CLAUDE.md,
// "prefer the simplest architecture that satisfies the contract").
import {
  getBlackHole,
  setBlackHole,
  getFallProgress,
  setFallProgress,
  setCompletedRun,
  markBlackHoleCompleted,
  hasCompletedBothBlackHoles,
  resetAllRuns,
  type BlackHoleType,
} from "../lib/state";
import {
  computeFallMetrics,
  formatClock,
  describeSignal,
  describeTidalStress,
  describeLatency,
  describeRedshiftSeverity,
  describeMessageOutcome,
  computeSignalTravelMs,
  MAX_FALL_PROGRESS,
} from "../lib/fall-sim";
import { withBase } from "../lib/base";

export function initExperience(): void {
  const root = document.querySelector<HTMLElement>('[data-testid="interaction-output"]');
  const beginButton = document.querySelector<HTMLButtonElement>('[data-testid="interaction"]');
  if (!root || !beginButton) return;

  const panels = root.querySelectorAll<HTMLElement>(".scene");
  const lookBackToggle = root.querySelector<HTMLButtonElement>("#look-back-toggle");
  const lookBackStateLabel = root.querySelector<HTMLElement>("#look-back-state");

  function setLookBack(on: boolean): void {
    if (!root) return;
    root.dataset.lookback = String(on);
    lookBackToggle?.setAttribute("aria-pressed", String(on));
    if (lookBackStateLabel) lookBackStateLabel.textContent = on ? "On" : "Off";
  }

  function showScene(scene: string): void {
    if (!root) return;
    root.dataset.scene = scene;
    // Look-back is a view of the falling scene, not app state -- leaving it
    // (impossible in the current forward-only flow, but cheap to guard)
    // should never leave a future scene stuck mid-warp.
    if (scene !== "falling") setLookBack(false);
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
  const EVENT_HORIZON_APPROACH_PROGRESS = 0.8;
  const CROSSING_DURATION_MS = 3200;
  const CROSSING_DURATION_MS_REDUCED = 500;
  const ESCAPE_ATTEMPT_DURATION_MS = 1400;
  const ESCAPE_ATTEMPT_DURATION_MS_REDUCED = 400;

  const descendControl = root.querySelector<HTMLButtonElement>("#descend-control");
  const fallHint = root.querySelector<HTMLElement>("#fall-hint");
  const fallStatus = root.querySelector<HTMLElement>("#fall-status");
  const fallClockYou = root.querySelector<HTMLElement>("#fall-clock-you");
  const fallClockEarth = root.querySelector<HTMLElement>("#fall-clock-earth");
  const fallReadoutYou = root.querySelector<HTMLElement>("#fall-readout-you");
  const fallReadoutEarth = root.querySelector<HTMLElement>("#fall-readout-earth");
  const fallCaption = root.querySelector<HTMLElement>("#fall-caption");
  const timelineSteps = root.querySelectorAll<HTMLElement>(".fall-timeline-step");
  const horizonBanner = root.querySelector<HTMLElement>("#horizon-banner");
  const horizonCrossedPanel = root.querySelector<HTMLElement>("#horizon-crossed-panel");
  const horizonCrossedHeading = root.querySelector<HTMLElement>("#horizon-crossed-heading");
  const fallAstronautCool = root.querySelector<HTMLElement>(".fall-astronaut-cool");
  const fallAstronautWarm = root.querySelector<HTMLElement>(".fall-astronaut-warm");
  const escapeAttempt = root.querySelector<HTMLElement>("#escape-attempt");
  const escapeControl = root.querySelector<HTMLButtonElement>("#escape-control");
  const escapeReadout = root.querySelector<HTMLElement>("#escape-readout");
  const escapeCoreLine = root.querySelector<HTMLElement>("#escape-core-line");
  const seeOutcomeButton = root.querySelector<HTMLButtonElement>("#see-outcome");
  const repeatRunHint = root.querySelector<HTMLElement>("#repeat-run-hint");
  const outcomeImage = root.querySelector<HTMLImageElement>("#outcome-image");
  const outcomeHeadline = root.querySelector<HTMLElement>("#outcome-headline");
  const outcomeStatTidal = root.querySelector<HTMLElement>("#outcome-stat-tidal");
  const outcomeStatCrossing = root.querySelector<HTMLElement>("#outcome-stat-crossing");
  const outcomeStatus = root.querySelector<HTMLElement>("#outcome-status");
  const tryOtherBlackHoleButton = root.querySelector<HTMLButtonElement>("#try-other-blackhole");
  const replayExperienceButton = root.querySelector<HTMLButtonElement>("#replay-experience");

  // Copy differs by black hole, but the "Interior fate: Unavoidable" stat in
  // the markup is identical for both -- that's the trick-question reveal
  // itself (the larger hole is gentler *at the horizon*, not gentler
  // overall), so it's never duplicated per-type here.
  const OUTCOME_COPY: Record<
    BlackHoleType,
    { headline: string; crossing: string; image: string; alt: string }
  > = {
    stellar: {
      headline: "Spaghettified well before the horizon.",
      crossing: "Rapid destruction",
      image: "img/astronaut-spaghetti.webp",
      alt: "An astronaut stretched into an extreme thread by severe tidal forces",
    },
    supermassive: {
      headline: "Crossed the horizon intact.",
      crossing: "Crossed intact",
      image: "img/astronaut-reach-warm.webp",
      alt: "An astronaut mildly stretched by comparatively gentle tidal forces",
    },
  };

  // Elements whose transition duration is stretched to the cinematic crossing
  // length (or shortened under reduced motion) for the crossing sequence,
  // then released back to their normal stylesheet duration once
  // finishCrossing() lands -- see beginCrossing().
  const cinematicTargets = [fallAstronautCool, fallAstronautWarm, horizonBanner].filter(
    (el): el is HTMLElement => el !== null,
  );

  let crossing = false;
  let crossed = false;
  let escaping = false;
  let escapeAttempted = false;
  let youClockSeconds = 0;
  let youClockIntervalId: ReturnType<typeof setInterval> | undefined;
  let crossingTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let escapeTimeoutId: ReturnType<typeof setTimeout> | undefined;

  function startYouClockTicking(): void {
    if (youClockIntervalId !== undefined) return;
    youClockIntervalId = setInterval(() => {
      youClockSeconds += 1;
      if (fallClockYou) fallClockYou.textContent = formatClock(youClockSeconds);
    }, 1000);
  }

  function renderFall(progress: number): void {
    if (!root) return;
    const metrics = computeFallMetrics(progress, getBlackHole());
    setFallProgress(metrics.progress);

    if (fallClockYou) fallClockYou.textContent = formatClock(metrics.properTimeSeconds);
    if (fallClockEarth) fallClockEarth.textContent = formatClock(metrics.observedTimeSeconds);
    if (fallReadoutYou) {
      fallReadoutYou.textContent = `Conceptual distance to horizon: ${metrics.distanceToHorizonPercent}%`;
    }
    if (fallReadoutEarth) {
      fallReadoutEarth.textContent = `Signal: ${describeSignal(metrics.signalStrength)}`;
    }
    if (fallCaption) {
      fallCaption.textContent = `Conceptual redshift ×${metrics.redshiftFactor.toFixed(1)} · Tidal stress: ${describeTidalStress(metrics.tidalStress)}`;
    }

    root.style.setProperty("--fall-lensing", String(metrics.lensingIntensity));
    root.style.setProperty("--fall-warmth", String(Math.min(1, (metrics.redshiftFactor - 1) / 3)));
    root.style.setProperty("--fall-brightness", String(metrics.observerBrightness));
    root.style.setProperty("--fall-motion-blur", `${(metrics.apparentVelocity * 2).toFixed(2)}px`);

    youClockSeconds = metrics.properTimeSeconds;

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

    // "A subtle countdown or approach threshold": a one-time announcement and
    // banner reveal the moment progress crosses into the horizon-approach
    // zone, rather than a literal ticking number.
    if (!crossed && !crossing) {
      if (metrics.progress >= EVENT_HORIZON_APPROACH_PROGRESS) {
        if (root.dataset.horizon !== "approaching") {
          root.dataset.horizon = "approaching";
          if (fallStatus) fallStatus.textContent = "Approaching the event horizon. Point of no return.";
        }
      } else if (root.dataset.horizon === "approaching") {
        delete root.dataset.horizon;
      }
    }

    if (descendControl && metrics.progress >= MAX_FALL_PROGRESS && !crossed && !crossing) {
      descendControl.disabled = false;
      descendControl.textContent = "Cross the event horizon";
      if (fallHint) {
        fallHint.textContent = "This is the point of no return. Press to cross the event horizon.";
      }
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

  // Crossing is a scripted, discrete event, not a continued function of
  // `progress` -- fall-sim.ts's formulas diverge as progress -> 1, so there
  // is no "progress = 1" to render. On the YOU side, deliberately nothing
  // changes beyond what was already true at the threshold: no new explosion,
  // wall, or portal, and the proper-time clock simply keeps ticking. On the
  // Earth side, the view intensifies to its dim, heavily redshifted,
  // signal-lost end state and freezes there -- "almost frozen", not gone.
  function beginCrossing(): void {
    if (!root) return;
    if (crossed || crossing) return;
    crossing = true;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? CROSSING_DURATION_MS_REDUCED : CROSSING_DURATION_MS;
    cinematicTargets.forEach((el) => {
      el.style.transitionDuration = `${duration}ms`;
    });

    root.dataset.horizon = "crossing";
    if (descendControl) {
      descendControl.disabled = true;
      descendControl.textContent = "Crossing…";
    }
    if (sendSignalButton) sendSignalButton.disabled = true;
    if (fallReadoutEarth) fallReadoutEarth.textContent = "Signal: lost";
    root.style.setProperty("--fall-brightness", "0.05");
    root.style.setProperty("--fall-warmth", "1");
    root.style.setProperty("--fall-motion-blur", "2.5px");
    if (fallStatus) fallStatus.textContent = "Crossing the event horizon.";

    // A signal already in flight has nowhere left to arrive -- resolve it as
    // lost now rather than letting its own timeout land later and silently
    // re-enable the send button / overwrite "Signal: lost" with a stale
    // in-transit result.
    if (signalTimeoutId !== undefined) {
      clearTimeout(signalTimeoutId);
      signalTimeoutId = undefined;
      signalSending = false;
      if (signalOutgoing) signalOutgoing.textContent = "Lost";
      if (signalObserved) signalObserved.textContent = "Lost — horizon crossed mid-transit";
      if (signalReceived) signalReceived.textContent = "Never arrives";
      if (signalStatus) signalStatus.textContent = "Signal lost: the horizon was crossed before it arrived.";
      signalPulse?.classList.remove("is-armed", "is-arriving");
    }

    crossingTimeoutId = setTimeout(() => {
      crossingTimeoutId = undefined;
      finishCrossing();
    }, duration);
  }

  function finishCrossing(): void {
    if (!root) return;
    crossing = false;
    crossed = true;
    root.dataset.horizon = "crossed";
    cinematicTargets.forEach((el) => {
      el.style.transitionDuration = "";
    });
    if (descendControl) {
      descendControl.disabled = true;
      descendControl.textContent = "Beyond the horizon";
    }
    if (fallStatus) fallStatus.textContent = "Horizon crossed.";
    if (horizonCrossedPanel) {
      horizonCrossedPanel.removeAttribute("inert");
      horizonCrossedPanel.setAttribute("aria-hidden", "false");
    }
    if (escapeAttempt) {
      escapeAttempt.removeAttribute("inert");
      escapeAttempt.setAttribute("aria-hidden", "false");
    }
    startYouClockTicking();
    if (horizonCrossedHeading) {
      horizonCrossedHeading.setAttribute("tabindex", "-1");
      horizonCrossedHeading.focus();
    }
  }

  // A plain click (or Enter/Space via native button semantics), not a hold --
  // crossing is a deliberate one-shot action, distinct from the hold-to-fall
  // gesture above. startHold()'s own cap guard already makes any lingering
  // pointerdown/keydown hold attempt at this point a no-op.
  descendControl?.addEventListener("click", () => {
    if (getFallProgress() >= MAX_FALL_PROGRESS && !crossed && !crossing) {
      beginCrossing();
    }
  });

  // "One last agency moment": a single brief attempt, not a repeatable
  // toggle. The cone and thrust meter both flare outward as if escape were
  // on the table, then settle back to the same narrow, inward-converging
  // geometry that was already true -- recoloured and paired with the core
  // line, so the point is felt rather than just stated. Kept to one shot so
  // it reinforces the crossing's own point-of-no-return framing instead of
  // becoming a game to retry.
  function attemptEscape(): void {
    if (!crossed || escaping || escapeAttempted) return;
    escaping = true;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion
      ? ESCAPE_ATTEMPT_DURATION_MS_REDUCED
      : ESCAPE_ATTEMPT_DURATION_MS;

    if (escapeAttempt) escapeAttempt.dataset.escape = "attempting";
    if (escapeControl) {
      escapeControl.disabled = true;
      escapeControl.textContent = "Engines firing…";
    }
    if (escapeReadout) escapeReadout.textContent = "Thrust: firing · Local velocity: rising";
    if (fallStatus) fallStatus.textContent = "Attempting escape. Engines firing.";

    escapeTimeoutId = setTimeout(() => {
      escapeTimeoutId = undefined;
      escaping = false;
      escapeAttempted = true;
      if (escapeAttempt) escapeAttempt.dataset.escape = "inevitable";
      if (escapeControl) escapeControl.textContent = "No route exists";
      if (escapeReadout) {
        escapeReadout.textContent = "Thrust: futile · Local velocity: irrelevant";
      }
      if (escapeCoreLine) escapeCoreLine.setAttribute("aria-hidden", "false");
      if (seeOutcomeButton) seeOutcomeButton.hidden = false;
      if (fallStatus) fallStatus.textContent = "Every future direction leads inward.";
    }, duration);
  }

  escapeControl?.addEventListener("click", attemptEscape);

  // Reads the black hole actually chosen this run and the fall-sim metrics
  // it produced, rather than hardcoding a second stellar/supermassive
  // comparison -- describeTidalStress() is the one source of truth for
  // "severe" vs "mild" (see fall-sim.ts), so the two never drift apart.
  function renderOutcome(): void {
    const blackHole = getBlackHole() ?? "stellar";
    const metrics = computeFallMetrics(getFallProgress(), blackHole);
    const copy = OUTCOME_COPY[blackHole];

    if (outcomeImage) {
      outcomeImage.src = withBase(copy.image);
      outcomeImage.alt = copy.alt;
    }
    if (outcomeHeadline) outcomeHeadline.textContent = copy.headline;
    if (outcomeStatTidal) {
      const tidal = describeTidalStress(metrics.tidalStress);
      outcomeStatTidal.textContent = tidal.charAt(0).toUpperCase() + tidal.slice(1);
    }
    if (outcomeStatCrossing) outcomeStatCrossing.textContent = copy.crossing;
    if (outcomeStatus) {
      outcomeStatus.textContent = `Outcome shown for the ${blackHole} black hole: ${copy.headline}`;
    }
    setCompletedRun(true);
    markBlackHoleCompleted(blackHole);
  }

  seeOutcomeButton?.addEventListener("click", () => {
    renderOutcome();
    showScene(hasCompletedBothBlackHoles() ? "comparison" : "outcome");
  });

  beginDescentButton?.addEventListener("click", () => {
    renderFall(getFallProgress());
    showScene("falling");
  });

  // -- "Look back": a viewpoint toggle, not a new scene. It flips a single
  // attribute on the persistent .experience root; the CSS (scoped to
  // [data-scene="falling"][data-lookback="true"]) does the rest, so turning
  // it off is just removing the attribute -- the prior view comes back on
  // its own, no state to restore by hand.
  lookBackToggle?.addEventListener("click", () => {
    setLookBack(lookBackToggle.getAttribute("aria-pressed") !== "true");
  });

  // -- the "I'm OK" signal experiment: a pulse sent from YOU that Earth
  // receives later, weaker and redder the deeper it was sent from. Its
  // properties are fixed at the moment of sending, not recomputed mid-flight,
  // so descending further while a pulse travels doesn't retroactively change
  // it -- the pulse already left that shell of spacetime.
  const sendSignalButton = root.querySelector<HTMLButtonElement>("#send-signal");
  const signalStatus = root.querySelector<HTMLElement>("#signal-status");
  const signalPulse = root.querySelector<HTMLElement>("#signal-pulse");
  const signalOutgoing = root.querySelector<HTMLElement>("#signal-outgoing");
  const signalLatency = root.querySelector<HTMLElement>("#signal-latency");
  const signalObserved = root.querySelector<HTMLElement>("#signal-observed");
  const signalRedshift = root.querySelector<HTMLElement>("#signal-redshift");
  const signalReceived = root.querySelector<HTMLElement>("#signal-received");

  let signalSending = false;
  let signalTimeoutId: ReturnType<typeof setTimeout> | undefined;

  function sendSignal(): void {
    // Belt-and-suspenders against spam-clicking: the button is disabled for
    // the whole trip, but a stray event (or a test firing clicks faster than
    // the DOM updates) must never be allowed to start a second timer.
    if (signalSending) return;
    signalSending = true;
    if (signalTimeoutId !== undefined) {
      clearTimeout(signalTimeoutId);
      signalTimeoutId = undefined;
    }

    const progress = getFallProgress();
    const metrics = computeFallMetrics(progress, getBlackHole());
    const travelMs = computeSignalTravelMs(progress);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (sendSignalButton) {
      sendSignalButton.disabled = true;
      sendSignalButton.textContent = "Sending…";
    }
    if (signalOutgoing) signalOutgoing.textContent = "Sending";
    if (signalLatency) signalLatency.textContent = describeLatency(progress);
    if (signalRedshift) signalRedshift.textContent = describeRedshiftSeverity(metrics.redshiftFactor);
    if (signalObserved) signalObserved.textContent = "In transit";
    if (signalReceived) signalReceived.textContent = "—";
    if (signalStatus) signalStatus.textContent = "Signal sent toward Earth.";

    if (signalPulse) {
      signalPulse.style.transitionDuration = prefersReducedMotion ? "1ms" : `${travelMs}ms`;
      signalPulse.style.setProperty("--signal-stretch", (1 + metrics.redshiftFactor * 0.6).toFixed(2));
      signalPulse.style.setProperty(
        "--signal-arrival-opacity",
        Math.max(0.15, metrics.signalStrength).toFixed(2),
      );
      signalPulse.classList.remove("is-arriving");
      // force a reflow so the browser commits the reset "at YOU" state
      // before the "is-arriving" class kicks off the transition to Earth.
      void signalPulse.offsetWidth;
      signalPulse.classList.add("is-armed", "is-arriving");
    }

    signalTimeoutId = setTimeout(() => {
      signalTimeoutId = undefined;
      signalSending = false;
      const outcome = describeMessageOutcome(metrics.signalStrength);
      if (signalOutgoing) signalOutgoing.textContent = "Sent";
      if (signalObserved) signalObserved.textContent = describeSignal(metrics.signalStrength);
      if (signalReceived) signalReceived.textContent = outcome;
      if (signalStatus) signalStatus.textContent = `Earth side: ${outcome.toLowerCase()}.`;
      if (sendSignalButton) {
        sendSignalButton.disabled = false;
        sendSignalButton.textContent = "Send: I'm OK";
      }
      signalPulse?.classList.remove("is-armed", "is-arriving");
    }, travelMs);
  }

  sendSignalButton?.addEventListener("click", sendSignal);

  // Shared by both "try the other black hole" and "replay experience": every
  // per-run flag, clock, and scene readout below returns to its initial
  // value. What differs between the two callers is which black hole ends up
  // selected and which scene the visitor lands back in -- both handle that
  // themselves, around a call to this.
  function resetRunUI(): void {
    if (!root) return;
    crossing = false;
    crossed = false;
    escaping = false;
    escapeAttempted = false;
    holding = false;
    lastFrameTime = null;
    youClockSeconds = 0;
    if (youClockIntervalId !== undefined) {
      clearInterval(youClockIntervalId);
      youClockIntervalId = undefined;
    }
    if (crossingTimeoutId !== undefined) {
      clearTimeout(crossingTimeoutId);
      crossingTimeoutId = undefined;
    }
    if (escapeTimeoutId !== undefined) {
      clearTimeout(escapeTimeoutId);
      escapeTimeoutId = undefined;
    }
    delete root.dataset.horizon;
    cinematicTargets.forEach((el) => {
      el.style.transitionDuration = "";
    });

    syncStage?.classList.remove("synced");
    if (syncButton) syncButton.hidden = false;
    if (beginDescentButton) beginDescentButton.hidden = true;
    if (syncStatus) syncStatus.textContent = "";
    if (clockYou) clockYou.textContent = "--:--:--";
    if (clockEarth) clockEarth.textContent = "--:--:--";

    if (descendControl) {
      descendControl.disabled = false;
      descendControl.textContent = "Hold to descend";
      descendControl.setAttribute("aria-pressed", "false");
    }
    if (fallHint) {
      fallHint.textContent =
        "Hold the control below, or hold Arrow Down / S, to descend. Release to hold your position.";
    }
    if (fallStatus) fallStatus.textContent = "";
    if (fallClockYou) fallClockYou.textContent = "00:00:00";
    if (fallClockEarth) fallClockEarth.textContent = "00:00:00";
    if (fallReadoutYou) fallReadoutYou.textContent = "Conceptual distance to horizon: 100%";
    if (fallReadoutEarth) fallReadoutEarth.textContent = "Signal: strong";
    if (fallCaption) fallCaption.textContent = "Conceptual redshift ×1.0 · Tidal stress: mild";
    timelineSteps.forEach((step) => {
      step.classList.remove("is-active", "is-complete");
      step.removeAttribute("aria-current");
    });
    if (horizonCrossedPanel) {
      horizonCrossedPanel.setAttribute("inert", "");
      horizonCrossedPanel.setAttribute("aria-hidden", "true");
    }

    if (escapeAttempt) {
      escapeAttempt.setAttribute("inert", "");
      escapeAttempt.setAttribute("aria-hidden", "true");
      delete escapeAttempt.dataset.escape;
    }
    if (escapeControl) {
      escapeControl.disabled = false;
      escapeControl.textContent = "Fire engines";
    }
    if (escapeReadout) escapeReadout.textContent = "Thrust: idle · Local velocity: steady";
    if (escapeCoreLine) escapeCoreLine.setAttribute("aria-hidden", "true");
    if (seeOutcomeButton) seeOutcomeButton.hidden = true;

    if (signalTimeoutId !== undefined) {
      clearTimeout(signalTimeoutId);
      signalTimeoutId = undefined;
    }
    signalSending = false;
    if (sendSignalButton) {
      sendSignalButton.disabled = false;
      sendSignalButton.textContent = "Send: I'm OK";
    }
    if (signalStatus) signalStatus.textContent = "";
    if (signalOutgoing) signalOutgoing.textContent = "Idle";
    if (signalLatency) signalLatency.textContent = "—";
    if (signalObserved) signalObserved.textContent = "—";
    if (signalRedshift) signalRedshift.textContent = "—";
    if (signalReceived) signalReceived.textContent = "—";
    signalPulse?.classList.remove("is-armed", "is-arriving");

    renderFall(0);
  }

  // "Resets simulation while retaining that the user has already completed
  // one run": completedRun/completedBlackHoles (state.ts) are deliberately
  // left set so the selecting scene can acknowledge this isn't a first
  // visit -- unlike blackHole/fallProgress, which a fresh run must genuinely
  // restart from. Reroutes to "selecting" (not straight back into falling)
  // with the other black hole pre-checked, since #repeat-run-hint lives in
  // that scene.
  function resetForOtherBlackHole(): void {
    if (!root) return;
    const previous = getBlackHole();
    const other: BlackHoleType = previous === "supermassive" ? "stellar" : "supermassive";

    setCompletedRun(true);
    setBlackHole(other);
    setFallProgress(0);
    resetRunUI();

    blackHoleInputs.forEach((input) => {
      input.checked = input.value === other;
    });
    if (startDescentButton) startDescentButton.disabled = false;
    if (descentSummary) descentSummary.textContent = "";
    if (repeatRunHint && previous) {
      repeatRunHint.hidden = false;
      repeatRunHint.textContent = `You already rode the fall into the ${previous} black hole. This run starts fresh with the ${other} black hole.`;
    }

    showScene("selecting");
  }

  tryOtherBlackHoleButton?.addEventListener("click", resetForOtherBlackHole);

  // A genuine restart, unlike "try the other black hole" -- every
  // module-singleton in state.ts goes back to its first-visit value,
  // including completedBlackHoles, and the visitor lands on the hero scene
  // rather than mid-way through the flow.
  function replayExperience(): void {
    if (!root) return;
    resetAllRuns();
    resetRunUI();

    blackHoleInputs.forEach((input) => {
      input.checked = false;
    });
    if (startDescentButton) startDescentButton.disabled = true;
    if (descentSummary) descentSummary.textContent = "";
    if (repeatRunHint) {
      repeatRunHint.hidden = true;
      repeatRunHint.textContent = "";
    }

    showScene("hero");
  }

  replayExperienceButton?.addEventListener("click", replayExperience);
}

initExperience();
