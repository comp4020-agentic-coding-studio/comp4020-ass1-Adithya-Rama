# Process overview

## What I built

FALL is a single-page visualisation of falling into a black hole, told twice:
once as YOU (infalling) and once as EARTH (observing) --- diverging clocks, a
signal that redshifts into silence before it arrives, and a closing comparison
of a stellar vs. a supermassive black hole's tidal survivability. It's
scripted interaction state, not a physics engine: the idea has to live in what
visibly changes when a visitor acts, not in a paragraph next to it.

## The moments that mattered

**Timer corruption became a lifecycle rule, not a re-prompt.** An edge-case
sweep --- rapid clicks, resize mid-animation, crossing the horizon while a
signal was in flight, replaying repeatedly --- found that `beginCrossing()`
never cancelled a pending `sendSignal()` timeout. Cross the horizon before a
signal resolves, and the stale callback still fires later, silently
re-enabling the send button and overwriting "Signal: lost" with an in-transit
result. The obvious fix was patching that one call site. Instead I had the
agent notice that `sendSignal()` already tracked its own timeout correctly
(`signalTimeoutId`) and generalise that into a standing `CLAUDE.md` rule:
every scripted-transition timer gets a handle, cancelled by every path that
can pre-empt it, not just reset. `src/scripts/experience.ts`, `CLAUDE.md`
([`eb9bb71...6a99280`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/compare/eb9bb71...6a99280)).
I knew it held because the fix later earned a permanent regression test
rather than a one-off manual check: `e2e/core-contract.e2e.ts`, wired into
`pnpm check` and CI
([`52148ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/52148ef)).

**Mobile got rebuilt, not shrunk.** The first mobile pass was a media query
scaling desktop styles down. It didn't match the phone reference image, and
it had a real bug: a fixed `max-width` on `.comparison-detail` could exceed a
390px viewport. Rather than patch the breakpoint again, I had the agent
discard the shrink-desktop assumption and rebuild the sync/fall stages as
condensed two-column grids matching the reference.
`src/pages/index.astro`
([`1a84e36`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/1a84e36)).
Verified with a temporary Playwright driver across all seven touchpoints at
390x844 and 1920x1080: no horizontal overflow, and simulation state survives
a resize mid-fall --- the existing Responsive invariant in `CLAUDE.md`.

**A reduced-motion bug that only a real audit would surface.** `.sync-clock`
and `.sync-connector-pulse` had `prefers-reduced-motion` overrides, but the
animations were actually declared under the higher-specificity
`.sync-stage.synced .sync-clock` rule, so the plain-class override silently
lost and both kept animating with reduced motion on.
`src/pages/index.astro`
([`e3f09ee`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/e3f09ee)).
I only found this by auditing every animated touchpoint against the Motion
invariant rather than trusting that a global override block worked as
written; the fix matches the selector that actually wins, with a comment
explaining why the bare class wasn't enough.

**Scientific honesty caught its own blind spot.** A dedicated audit against
`CLAUDE.md`'s Scientific-honesty rule found two live readouts --- distance to
horizon, redshift multiplier --- displaying bare numbers with no hedge, unlike
every other numeric display in the app. It also found "Thrust: exhausted"
implying a fixable fuel budget where the point is that escape is impossible.
`src/pages/index.astro`, `src/scripts/experience.ts`
([`9afb8bc`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/9afb8bc)).
I trusted the result because the audit was run against all eight of the
brief's stated principles and reported which ones needed no change, not just
the ones that did.
