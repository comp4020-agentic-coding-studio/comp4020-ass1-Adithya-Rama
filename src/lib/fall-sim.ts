// Pure, deterministic derivations from a single normalized fall parameter.
// progress: 0 = far from the black hole, 1 = horizon crossing. Deliberately
// not general relativity -- these curves are chosen to point in the right
// physical direction (proper time ticks steadily; the distant observer's
// read of it diverges without bound near the horizon; apparent velocity
// rises then freezes; redshift diverges) rather than to be numerically
// exact. Crossing progress = 1 is out of scope for this stage:
// MAX_FALL_PROGRESS caps how far the interaction can push it.
import type { BlackHoleType } from "./state";

export const MAX_FALL_PROGRESS = 0.94;

const PROPER_TIME_SCALE_SECONDS = 90;
const OBSERVED_TIME_SCALE_SECONDS = 70;

export interface FallMetrics {
  progress: number;
  properTimeSeconds: number;
  observedTimeSeconds: number;
  apparentVelocity: number;
  signalStrength: number;
  redshiftFactor: number;
  distanceToHorizonPercent: number;
  lensingIntensity: number;
  observerBrightness: number;
  tidalStress: number;
}

export function computeFallMetrics(progress: number, blackHole: BlackHoleType | null): FallMetrics {
  const p = Math.min(Math.max(progress, 0), MAX_FALL_PROGRESS);

  // Tidal force at a fixed fraction of the horizon radius scales with
  // 1 / mass^2 -- a stellar black hole's tiny horizon makes the same
  // normalized approach far more violent than a supermassive one's, echoing
  // the "extreme" vs "much milder" comparison from the black-hole choice.
  const tidalGain = blackHole === "stellar" ? 1 : blackHole === "supermassive" ? 0.15 : 0.5;

  return {
    progress: p,
    properTimeSeconds: p * PROPER_TIME_SCALE_SECONDS,
    observedTimeSeconds: -OBSERVED_TIME_SCALE_SECONDS * Math.log(1 - p),
    apparentVelocity: 4 * p * (1 - p),
    signalStrength: (1 - p) ** 2,
    redshiftFactor: 1 / Math.sqrt(1 - p),
    distanceToHorizonPercent: Math.round((1 - p) * 100),
    lensingIntensity: p * p,
    observerBrightness: Math.sqrt(1 - p),
    tidalStress: Math.min(1, p * p * tidalGain * 1.2),
  };
}

export function formatClock(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(whole / 3600);
  const mm = Math.floor((whole % 3600) / 60);
  const ss = whole % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":");
}

export function describeSignal(strength: number): string {
  if (strength > 0.66) return "strong";
  if (strength > 0.33) return "fading";
  return "faint";
}

export function describeTidalStress(stress: number): string {
  if (stress < 0.2) return "mild";
  if (stress < 0.5) return "rising";
  if (stress < 0.8) return "severe";
  return "extreme";
}
