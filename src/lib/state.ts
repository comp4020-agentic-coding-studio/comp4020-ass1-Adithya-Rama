// Deliberately a plain module singleton, not a store library -- one visitor,
// one session, no persistence across reload required. The chosen black hole
// has to survive the hero -> selecting -> syncing -> falling scene
// transitions and eventually shape the tidal-force outcome later in the
// journey.
export type BlackHoleType = "stellar" | "supermassive";

let selectedBlackHole: BlackHoleType | null = null;

export function setBlackHole(choice: BlackHoleType): void {
  selectedBlackHole = choice;
}

export function getBlackHole(): BlackHoleType | null {
  return selectedBlackHole;
}

// The fall's progress lives here as a plain number, never derived from
// element geometry or scroll position -- so a viewport resize can't disturb
// it, and the fall simulation survives a reflow for free.
let fallProgress = 0;

export function setFallProgress(value: number): void {
  fallProgress = value;
}

export function getFallProgress(): number {
  return fallProgress;
}

// Whether the visitor has already ridden the fall to its outcome at least
// once. "Try the other black hole" resets blackHole/fallProgress for a
// second run but must NOT reset this -- it's what lets the selecting scene
// acknowledge the earlier run instead of pretending this is a first visit.
let completedRun = false;

export function setCompletedRun(value: boolean): void {
  completedRun = value;
}

export function getCompletedRun(): boolean {
  return completedRun;
}
