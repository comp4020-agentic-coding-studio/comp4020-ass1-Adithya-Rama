// Deliberately a plain module singleton, not a store library -- one visitor,
// one session, no persistence across reload required. The chosen black hole
// has to survive the hero -> selecting -> descending scene transitions and
// eventually shape the tidal-force outcome later in the journey.
export type BlackHoleType = "stellar" | "supermassive";

let selectedBlackHole: BlackHoleType | null = null;

export function setBlackHole(choice: BlackHoleType): void {
  selectedBlackHole = choice;
}

export function getBlackHole(): BlackHoleType | null {
  return selectedBlackHole;
}
