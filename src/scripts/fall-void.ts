// The descent's motion, hand-written on a 2D canvas -- no animation library
// (CLAUDE.md, Performance: "no large dependency for something a small
// hand-written function can do").
//
// Why a canvas at all, when the rest of the project is CSS: the descent has to
// read as *travel*, and the four effects that sell it -- multi-layer parallax,
// starlight bending around the hole, radial streaks that lengthen with speed,
// and dust rushing past camera -- all need per-star maths that CSS cannot
// express. The still images stay as texture underneath; they are no longer
// asked to be the movement.
//
// Determinism (CLAUDE.md): the star and dust tables are generated once from a
// fixed seed through mulberry32, never Math.random, so the field is identical
// on every build and every reload. The field then *evolves* over time from
// that fixed start, which is the one thing a moving scene cannot avoid -- so
// the descent is verified by measured escalation between milestones, not by
// pixel equality.
import { mulberry32 } from "../lib/rng";

const SEED = 0xfa11;

export type FallPhase = "approach" | "crossing" | "crossed";

interface Star {
  /** angle around the hole, radians */
  angle: number;
  /** normalised distance from the hole centre, 1 == half the viewport's short edge */
  radius: number;
  /** 0..1 jitter used for per-star size/alpha variety */
  variance: number;
}

interface Dust {
  angle: number;
  radius: number;
  /** how close to camera: bigger == faster and larger */
  depth: number;
}

interface StarLayer {
  stars: Star[];
  /** parallax factor: near layers sweep past faster than far ones */
  depth: number;
  size: number;
  alpha: number;
}

/** Per-layer budgets at a reference 1920x1080; scaled down on small screens. */
const LAYER_SPEC = [
  { count: 260, depth: 0.3, size: 0.8, alpha: 0.4 },
  { count: 150, depth: 0.68, size: 1.2, alpha: 0.66 },
  { count: 74, depth: 1.15, size: 1.8, alpha: 0.95 },
];
const DUST_COUNT = 42;

/** The bright rim is drawn, not photographed, so it can actually rotate. */
const RIM_ARCS = 16;

/** How long the intense part of the crossing lasts, inside the scripted window. */
const CROSSING_FLARE_MS = 1200;

export interface FallVoid {
  /** Begin animating. Idempotent. */
  start(): void;
  /** Stop and release the frame handle. Idempotent. */
  stop(): void;
  /** True while a frame is scheduled -- used by tests to prove no loop leaks. */
  isRunning(): boolean;
  /** Normalised fall progress, 0..MAX_FALL_PROGRESS. */
  setProgress(progress: number): void;
  /** Signed progress delta from the visitor's last input; drives speed/streaks. */
  noteMotion(delta: number): void;
  setPhase(phase: FallPhase): void;
  /** Re-read the backing store size after a viewport change. */
  resize(): void;
}

export function createFallVoid(canvas: HTMLCanvasElement): FallVoid {
  const context = canvas.getContext("2d");

  const random = mulberry32(SEED);
  const layers: StarLayer[] = [];
  let dust: Dust[] = [];

  let width = 0;
  let height = 0;
  let shortEdge = 0;

  let progress = 0;
  /** Smoothed signed speed in progress-per-second, used for streaks and drift. */
  let velocity = 0;
  /** Raw signed input accumulated since the last frame. */
  let pendingMotion = 0;
  let phase: FallPhase = "approach";
  let phaseChangedAt = 0;

  let frameHandle = 0;
  let lastFrame = 0;
  let lastDraw = 0;
  /** Advances only while the scene is animating, so a paused fall is still. */
  let sceneTime = 0;

  let reducedMotion = false;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function starCountScale(): number {
    // Fewer stars on a phone: same look, a third of the per-frame cost.
    const area = Math.max(width * height, 1);
    return Math.min(1, Math.max(0.35, area / (1920 * 1080)));
  }

  function buildField(): void {
    layers.length = 0;
    const scale = starCountScale();
    LAYER_SPEC.forEach((spec) => {
      const count = Math.max(12, Math.round(spec.count * scale));
      const stars: Star[] = [];
      for (let i = 0; i < count; i += 1) {
        stars.push({
          angle: random() * Math.PI * 2,
          // sqrt keeps the field even across area rather than crowding the centre
          radius: 0.06 + Math.sqrt(random()) * 1.35,
          variance: random(),
        });
      }
      layers.push({ stars, depth: spec.depth, size: spec.size, alpha: spec.alpha });
    });

    dust = [];
    const dustCount = Math.max(10, Math.round(DUST_COUNT * scale));
    for (let i = 0; i < dustCount; i += 1) {
      dust.push({
        angle: random() * Math.PI * 2,
        radius: 0.05 + random() * 1.2,
        depth: 0.4 + random() * 0.9,
      });
    }
  }

  function resize(): void {
    // Cap DPR at 2: a 3x phone buffer triples fill cost for no visible gain.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(rect.width, 1);
    const cssHeight = Math.max(rect.height, 1);
    width = cssWidth;
    height = cssHeight;
    shortEdge = Math.min(cssWidth, cssHeight);
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    if (context) {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    if (layers.length === 0) buildField();
    // Never let a resize disturb the simulation -- only the backing store
    // changes (CLAUDE.md, Responsive invariant). Redraw immediately so a
    // reduced-motion viewer, whose loop is not running, still sees the scene.
    draw();
  }

  /**
   * How far the hole's dark disc reaches, in canvas pixels. Grows with
   * progress, which is what makes "the hole is getting closer" measurable.
   */
  function discRadius(): number {
    // Keep the procedural shadow inside the photographed event horizon. The
    // previous radius grew beyond the image's rim and became a visibly pasted
    // black circle near p=.94. The background zoom now sells proximity; this
    // shadow only deepens the existing void and occludes lensed stars.
    const base = shortEdge * 0.072;
    const grown = base * (1 + progress * 1.35);
    return phase === "crossed" ? grown * 1.08 : grown;
  }

  /** 0 at rest, 1 at a brisk descent; drives streak length and dust speed. */
  function speedFactor(): number {
    return Math.min(1, Math.abs(velocity) / 0.32);
  }

  function crossingFlare(): number {
    if (phase === "approach") return 0;
    if (phase === "crossed") return 0;
    const elapsed = sceneTime - phaseChangedAt;
    if (elapsed <= 0) return 0;
    if (elapsed >= CROSSING_FLARE_MS) return 0;
    // Ramp up fast, fall away slower: a bloom, not a strobe.
    const t = elapsed / CROSSING_FLARE_MS;
    return t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
  }

  /**
   * Gravitational lensing, as a displacement rather than a shader: a star's
   * apparent radius is pushed outward and its angle swept around the hole,
   * both falling off with distance, so the field visibly *curves* around the
   * disc instead of sliding past it in straight lines. Illustrative, not a
   * ray-traced null geodesic (CLAUDE.md, Scientific honesty).
   */
  function lens(radius: number, strength: number): { radius: number; sweep: number } {
    const soft = 0.16;
    const falloff = 1 / (radius * radius + soft);
    return {
      radius: radius + strength * 0.09 * falloff,
      sweep: strength * 0.55 * falloff,
    };
  }

  function draw(): void {
    if (!context || width === 0 || height === 0) return;

    const cx = width / 2;
    const cy = height / 2;
    const unit = shortEdge / 2;
    const flare = crossingFlare();
    const calm = phase === "crossed";
    const speed = calm ? 0 : speedFactor();
    // Lensing strength: mostly progress, pushed hard during the crossing bloom.
    const lensStrength = progress * progress * 1.9 + flare * 1.4;

    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";

    layers.forEach((layer) => {
      // Trails express motion, not position. A paused visitor should see bent
      // stars settle back to points instead of permanent warp-speed lines.
      const streakScale = (speed * 0.72 + flare * 1.15) * layer.depth;
      for (const star of layer.stars) {
        const bent = lens(star.radius, lensStrength);
        const angle = star.angle + bent.sweep;
        const radius = bent.radius * unit;
        if (radius > unit * 2.2) continue;

        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;

        // Inside the disc the star is behind the hole: don't draw it.
        if (radius < discRadius() * 0.98) continue;

        const size = layer.size * (0.5 + star.variance * 0.9);
        let alpha = layer.alpha * (0.45 + star.variance * 0.55);
        if (calm) alpha *= 0.35;

        const streak = streakScale * radius * 0.4;
        if (streak > 1.2) {
          // Trail points back toward the hole -- the direction travelled from.
          const inner = Math.max(radius - streak, discRadius());
          const gradient = context.createLinearGradient(
            cx + Math.cos(angle) * inner,
            cy + Math.sin(angle) * inner,
            x,
            y,
          );
          const tint = calm
            ? "255,150,140"
            : progress > 0.55
              ? "255,205,180"
              : "205,230,255";
          gradient.addColorStop(0, `rgba(${tint},0)`);
          gradient.addColorStop(1, `rgba(${tint},${alpha.toFixed(3)})`);
          context.strokeStyle = gradient;
          context.lineWidth = size;
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
          context.lineTo(x, y);
          context.stroke();
        } else {
          context.fillStyle = calm
            ? `rgba(255,170,160,${alpha.toFixed(3)})`
            : `rgba(226,240,255,${alpha.toFixed(3)})`;
          context.beginPath();
          context.arc(x, y, size * 0.5, 0, Math.PI * 2);
          context.fill();
        }
      }
    });

    // Foreground dust: close, fast, and always streaked, so there is something
    // unmistakably rushing past camera rather than just distant stars sliding.
    if (!calm && (speed > 0.02 || flare > 0)) {
      for (const mote of dust) {
        const radius = mote.radius * unit;
        if (radius < discRadius()) continue;
        const angle = mote.angle;
        const length = (speed * 1.5 + flare * 1.2) * mote.depth * unit * 0.28;
        if (length < 1) continue;
        const inner = Math.max(radius - length, discRadius());
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const alpha = Math.min(0.5, 0.12 + speed * 0.3) * mote.depth;
        const gradient = context.createLinearGradient(
          cx + Math.cos(angle) * inner,
          cy + Math.sin(angle) * inner,
          x,
          y,
        );
        gradient.addColorStop(0, "rgba(180,215,255,0)");
        gradient.addColorStop(1, `rgba(215,235,255,${alpha.toFixed(3)})`);
        context.strokeStyle = gradient;
        context.lineWidth = 1 + mote.depth * 1.4;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        context.lineTo(x, y);
        context.stroke();
      }
    }

    // The rim: drawn arcs so the accretion disc can genuinely rotate, at a
    // rate that rises with progress. Two counter-sweeping sets read as
    // orbiting material rather than a spinning photograph.
    // The rim: many thin arcs hugging the disc, so the accretion material reads
    // as orbiting at a rate that climbs with progress. Counter-sweeping sets
    // avoid the "one spinning photograph" look; keeping them thin and close
    // avoids the "stray brush strokes" one.
    const disc = discRadius();
    const spin = sceneTime / 1000;
    for (let i = 0; i < RIM_ARCS; i += 1) {
      const t = i / RIM_ARCS;
      const direction = i % 2 === 0 ? 1 : -1;
      const rate = (0.1 + progress * 0.7) * direction;
      const start = t * Math.PI * 2 * 1.7 + spin * rate;
      const sweep = 0.18 + t * 0.34;
      const ringRadius = disc * (1.01 + t * 0.1);
      const warm = calm ? 1 : Math.min(1, progress * 1.35 + flare);
      const r = Math.round(150 + warm * 105);
      const g = Math.round(205 - warm * 80);
      const b = Math.round(255 - warm * 165);
      const alpha = (calm ? 0.1 : 0.1 + progress * 0.22 + flare * 0.4) * (1 - t * 0.5);
      context.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      context.lineWidth = Math.max(1, disc * 0.02 * (1 - t * 0.5));
      context.beginPath();
      context.arc(cx, cy, ringRadius, start, start + sweep);
      context.stroke();
    }

    // A soft inner shadow, not a replacement black hole. It stays translucent
    // enough that the photographed accretion rim remains visible right up to
    // the crossing; the full-frame engulf is handled as a camera move in CSS.
    context.globalCompositeOperation = "source-over";
    const core = Math.min(0.72, 0.16 + progress * 0.42 + flare * 0.16);
    const holeGradient = context.createRadialGradient(cx, cy, disc * 0.22, cx, cy, disc * 1.12);
    holeGradient.addColorStop(0, `rgba(0,0,0,${core.toFixed(3)})`);
    holeGradient.addColorStop(0.58, `rgba(0,0,0,${(core * 0.72).toFixed(3)})`);
    holeGradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = holeGradient;
    context.beginPath();
    context.arc(cx, cy, disc * 1.2, 0, Math.PI * 2);
    context.fill();

    lastDraw = sceneTime;
  }

  function advance(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    // Turn this frame's accumulated input into a smoothed signed speed. The
    // easing is what stops a coarse mouse wheel from reading as a series of
    // jolts.
    const instant = deltaSeconds > 0 ? pendingMotion / deltaSeconds : 0;
    pendingMotion = 0;
    const blend = Math.min(1, deltaSeconds * 7);
    velocity += (instant - velocity) * blend;
    if (Math.abs(velocity) < 0.0008) velocity = 0;

    if (phase === "crossed") {
      // Eerie calm: whatever motion was left bleeds away and nothing drifts.
      velocity *= 0.9;
      return;
    }

    // Stars sweep outward as you fall inward (and inward as you retreat), at a
    // rate set by actual visitor motion plus the crossing flare. At rest the
    // field settles, matching the instruction that release pauses the fall.
    const flare = crossingFlare();
    const drift = (velocity * 1.15 + flare * 0.5) * deltaSeconds;
    layers.forEach((layer) => {
      for (const star of layer.stars) {
        star.radius += drift * layer.depth * (0.55 + star.radius * 0.8);
        if (star.radius > 1.6) {
          star.radius = 0.06 + random() * 0.12;
          star.angle = random() * Math.PI * 2;
        } else if (star.radius < 0.05) {
          star.radius = 1.45 + random() * 0.14;
          star.angle = random() * Math.PI * 2;
        }
      }
    });

    const dustDrift = (velocity * 2.4 + flare * 1.1) * deltaSeconds;
    for (const mote of dust) {
      mote.radius += dustDrift * mote.depth * (0.6 + mote.radius);
      if (mote.radius > 1.5) {
        mote.radius = 0.05 + random() * 0.1;
        mote.angle = random() * Math.PI * 2;
        mote.depth = 0.4 + random() * 0.9;
      } else if (mote.radius < 0.04) {
        mote.radius = 1.35 + random() * 0.12;
        mote.angle = random() * Math.PI * 2;
      }
    }
  }

  function frame(timestamp: number): void {
    frameHandle = requestAnimationFrame(frame);
    const deltaMs = lastFrame === 0 ? 16 : Math.min(timestamp - lastFrame, 64);
    lastFrame = timestamp;
    sceneTime += deltaMs;

    advance(deltaMs);

    // Idle throttle: a paused fall has no drift worth 60fps. The rim still
    // turns, so redraw at ~20fps instead of stopping outright.
    const busy = Math.abs(velocity) > 0.002 || crossingFlare() > 0;
    if (!busy && sceneTime - lastDraw < 50) return;
    draw();
  }

  function start(): void {
    if (reducedMotion) {
      // No loop at all: the scene is redrawn once per state change instead.
      draw();
      return;
    }
    if (frameHandle !== 0) return;
    lastFrame = 0;
    frameHandle = requestAnimationFrame(frame);
  }

  function stop(): void {
    if (frameHandle === 0) return;
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
    lastFrame = 0;
    velocity = 0;
    pendingMotion = 0;
  }

  function applyReducedMotion(): void {
    reducedMotion = motionQuery.matches;
    if (reducedMotion) {
      stop();
      velocity = 0;
      draw();
    }
  }

  // Read live, not cached at init, so toggling the OS setting mid-session takes
  // effect (CLAUDE.md, Motion invariant).
  motionQuery.addEventListener("change", applyReducedMotion);
  reducedMotion = motionQuery.matches;

  return {
    start,
    stop,
    isRunning: () => frameHandle !== 0,
    setProgress(next: number) {
      progress = next;
      // Under reduced motion there is no loop to pick this up, so the state
      // change is committed as one static frame -- still fully legible, just
      // without the travel.
      if (reducedMotion) draw();
    },
    noteMotion(delta: number) {
      if (reducedMotion) return;
      pendingMotion += delta;
    },
    setPhase(next: FallPhase) {
      if (phase === next) return;
      phase = next;
      phaseChangedAt = sceneTime;
      if (reducedMotion) draw();
    },
    resize,
  };
}
