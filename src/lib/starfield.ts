import { mulberry32 } from "./rng";

export interface Star {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  duration: number;
  delay: number;
}

// Fixed seed: the layout must be identical on every build, not just every
// page load, so it stays reproducible for tests and screenshots.
const SEED = 1337;

export function generateStars(count: number): Star[] {
  const random = mulberry32(SEED);
  const stars: Star[] = [];

  for (let i = 0; i < count; i++) {
    stars.push({
      x: random() * 100,
      y: random() * 100,
      size: 1 + random() * 1.6,
      baseOpacity: 0.3 + random() * 0.6,
      duration: 2 + random() * 4,
      delay: random() * 4,
    });
  }

  return stars;
}
