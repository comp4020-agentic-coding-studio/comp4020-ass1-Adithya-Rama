# FALL — One Journey. Two Realities.

[**Open the live experience**](https://comp4020-agentic-coding-studio.github.io/comp4020-ass1-Adithya-Rama/)

FALL is an interactive explainer about approaching a black hole. It follows
the same event through two sources of evidence: the astronaut's local
experience and the progressively older, redder and fainter light received on
Earth.

## Point of view

An event horizon is not a visible wall, and the astronaut and Earth do not
occupy contradictory realities. They have access to different information.
Black-hole mass changes whether tidal forces destroy the astronaut before the
horizon, but it does not change the horizon's causal boundary.

The visitor learns this by controlling the descent rather than advancing
through a slideshow. Wheel, drag and keyboard input continuously alter the
camera, lensing, clocks, signal and tidal readouts. The stellar and
supermassive choices then branch at their first different physical
consequence.

## Core journey

1. Choose a stellar-mass or supermassive black hole.
2. Synchronise the astronaut and Earth clocks.
3. Descend with wheel, drag, hold or keyboard controls.
4. Turn back toward Earth and transmit a signal.
5. Reach tidal breakup or cross the event horizon, depending on the choice.
6. Test the remaining trajectory and compare both outcomes.

## Quick start

```sh
mise install
pnpm install
pnpm dev
pnpm check
pnpm check:evidence
pnpm build
```

The static client-side build uses Astro, TypeScript, semantic HTML, CSS and a
small procedural canvas renderer. `pnpm check` runs type checking, production
build, linting, invariant tests and desktop/mobile Playwright journeys.

## Process evidence

- [Process overview](PROCESS.md) — four cited corrections and how they were verified
- [Agent harness](CLAUDE.md) — project rules grown from observed failures
- [Assignment reflection](reflections/assignment-1.md) — the breakthrough and its before/after
- [Browser contract](e2e/core-contract.e2e.ts) — the complete journey and mutually exclusive fates

## Scientific scope

This is a conceptual visualisation, not a numerical general-relativity solver.
Its curves and percentages communicate direction and contrast; they are
deliberately labelled conceptual rather than presented as measurements.
