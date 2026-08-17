# Process overview

## What I built

FALL is a one-page interactive explanation of falling into a black hole. Its
point of view is that the event horizon is not simply a picture of being
"sucked in": the person falling and distant Earth receive different views of
the same event, while black-hole mass changes the traveller's tidal fate but
not the horizon's causal boundary. The experience is a conceptual model, not
a numerical physics simulation.

## The moments that mattered

**Static scenes became a continuous mechanic.** The early version changed
background images after button presses. I distilled the correction into a
concrete direction: mouse-wheel travel, not image switching, had to make the
approach visible. More frames and smoother fades were the obvious fix, but
they would still make the visitor watch a slideshow. I rejected that model
and made movement itself carry the explanation. Wheel, drag and keyboard input
now feed one reversible descent value; a procedural canvas, camera scale,
lensing and readouts all respond continuously
([`5b74342`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/5b74342)). I then turned the lesson into input-normalisation and animation-loop
rules in the harness
([`e7bc9ae`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/e7bc9ae)). I knew this was right because Playwright compared separated descent
milestones, exercised every input method, resized mid-fall and checked that no
animation frame or horizontal overflow leaked.

**Timer corruption became a lifecycle rule, not a local patch.** An edge-case
sweep found that crossing the horizon while a signal was in flight left its
timeout alive. The stale callback later re-enabled the button and overwrote
"Signal: lost." Instead of cancelling only that call site, I had the agent
generalise the existing timeout handle into a rule: every scripted timer must
be owned and cancelled by every transition that can pre-empt it
([`eb9bb71...6a99280`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/compare/eb9bb71...6a99280)). The result was not accepted from a manual replay; the exact crossing-with-signal-in-flight
failure became a permanent browser regression test in `pnpm check`
([`52148ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/52148ef)).

**Labels became genuinely different perspectives, and copy became a real
branch.** The next correction was that both journeys still felt the same:
YOU and EARTH were labels over essentially the same picture, and both
black-hole choices used the same intact post-horizon interaction. That also
contradicted the stellar result text, which said the astronaut was destroyed
before the horizon. Changing colours or final copy was the obvious cosmetic
response. I rejected the shared flow and split the cameras and causal
behaviour: YOU crosses locally while Earth receives older, redder, fainter
afterimages; stellar mass ends in tidal breakup with no engine control, while supermassive
mass permits intact crossing before escape still becomes impossible
([`af5d43e`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/af5d43e)). I added the "labels are not viewpoints" and mutually-exclusive-branch
rule to `CLAUDE.md`
([`d0a8809`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/d0a8809)). Browser assertions now prove both what each branch shows and what it
must not show at desktop and mobile sizes.

**Deployment verification learned the real GitHub Pages path.** The link
checker originally served `dist` at `/`, but production uses the repository
base path. That produced fourteen false 404s for otherwise valid assets. The
easy responses were to ignore those errors or remove the base path. Instead I
changed CI to stage the build beneath the repository-name directory and serve
its parent, reproducing the public URL structure
([`588e336`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/588e336)). The check now validates the same absolute paths a marker's browser
will request rather than a more convenient local topology. I accepted it only
after the public workflow's link crawl and Pages deployment both passed.
