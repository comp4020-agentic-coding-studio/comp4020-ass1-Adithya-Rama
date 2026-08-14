# COMP4020 prototype

This is your starter repo for a COMP4020 prototype: a static site written in
HTML/CSS/TypeScript that builds to plain HTML/CSS/JS and deploys to GitHub
Pages. The **deployed site is what gets marked** --- not this repo, and not "it
works on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. The types are extra
  backpressure: a red here is the compiler telling you a claim in the code is
  false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript. Flags code that's
  wrong, fragile, or non-idiomatic. Read the rule it names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

Out of the box this is plain HTML/CSS/TypeScript on Vite, and every `.html` file
in the repo is a page: add pages, link them, and the build picks them up with no
config. That's a default, not a rule (unless the week's spec says otherwise).
You can swap in Astro or any other static generator, because nothing in CI names
a tool --- the whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so configure your generator's base path --- this
template's Vite config uses relative asset URLs to sidestep that, but most
generators (Astro included) need `base` set explicitly, and getting it wrong
looks fine locally while every asset 404s on the live URL. And commit the
updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile`.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.

## Project

**FALL --- One Journey. Two Realities.** An interactive explainer of
gravitational time dilation: an infalling astronaut and a distant Earth
observer share one event and never agree on how long it took. The agreed
blueprint (file structure, state machine, asset mapping, physics
approximations) is the standing plan --- treat it as settled, not as a
proposal to re-litigate mid-build.

## Scope

Static, client-side prototype only. Do not add auth, a backend, a database,
payments, or any API integrations.

This project explains **one idea**: gravitational time and observation
diverge around a black hole. Tidal forces, signal delay, and horizon crossing
exist to support that one idea from different angles --- they are not
separate topics in their own right. Do not turn this into a general
black-hole encyclopedia. If a feature doesn't make the central divergence
more legible, it doesn't belong, however interesting it is on its own.

## Technology

Prefer Astro + CSS + semantic HTML. Use minimal JS.

## Quality priority

1. composition
2. proportions
3. hierarchy
4. spacing
5. typography
6. imagery
7. colour
8. micro-details

## Core interaction invariant

The visitor must be able to, in one continuous session:

- choose a black hole
- synchronise clocks
- begin the fall
- alter or progress their descent
- observe divergence between the infalling and distant-observer perspectives
- send at least one signal to Earth
- cross the event horizon
- receive an ending/result based on the black hole they chose

If a build doesn't let a visitor do all eight in order, it isn't done, no
matter how good any individual screen looks in isolation.

## Interaction quality

Every user-facing control must cause an immediate, visible state change. If
pressing a control doesn't change what's on screen within the same frame or
two, the control is broken, not just unpolished.

No primary educational idea may depend on the visitor reading a paragraph.
The interaction --- what visibly changes when they act --- has to carry the
explanation. Caption text may support what they're seeing; it may never be
the only place the idea lives.

## Visual quality

`assets/ref_images/` is canonical. It is not moodboard inspiration to riff on
--- it is the target. When a screen doesn't match its reference, the
reference is right and the screen is wrong.

The site must feel cinematic, immersive, and spatial. Concretely, that rules
out:

- SaaS-style cards
- dashboard-heavy layouts
- white backgrounds
- conventional navbar structures
- large blocks of explanatory text

UI overlays (stat panels, controls, readouts) may exist over the scene, but
the black hole and space scene must stay visually dominant --- overlays are a
layer on top of the experience, not the experience itself.

## Responsive invariant

The core experience must work with no horizontal scroll at both a narrow
mobile viewport and the standard desktop marking viewport (see the checks
list above: 1920×1080 and 390×844).

Resizing mid-interaction must never reset simulation state. The clocks,
velocity, and distance-to-horizon a visitor has already reached survive a
resize; only the layout may change.

## Keyboard invariant

Every one of the eight core-interaction steps above must be completable with
a keyboard alone. Never gate a step behind a hover-only affordance. Every
interactive element needs a visible focus state --- if you can't see where
focus is by looking at the screen, it doesn't count as accessible.

## Motion invariant

Animation exists to communicate a change of state, not to decorate. If an
animation doesn't tell the visitor something changed (position, time,
signal strength, danger), cut it.

Respect `prefers-reduced-motion`: anything that isn't essential to
understanding the current state must be disabled, or reduced to an instant
change, when the visitor has asked for reduced motion.

## Determinism

Any pseudo-random visual behaviour (starfield jitter, particle drift, and
the like) must be seeded/deterministic, not `Math.random()` called fresh on
every render. Tests and a marker's repeat viewing both depend on the same
input producing the same output.

## Performance

- No autoplay video anywhere in the experience.
- No large dependency for something a small hand-written function can do (a
  charting library for two line charts, an animation library for opacity
  cross-fades, etc.).
- Images load lazily where they aren't needed for the first paint.
- The first screen (the hero) must be usable on a slow connection: it should
  render and become interactive before every later-scene asset has finished
  loading.

## Scientific honesty

This is a conceptual visualisation, not a numerical general-relativity
solver. The physics functions are simplified closed-form approximations, not
geodesic integration --- that's a deliberate, documented choice, not a
shortcut to hide.

Never imply precision the model doesn't have. Where a displayed value is
illustrative rather than a real computed quantity, label it as such, so a
visitor can't mistake dramatic license for a rigorous result.

## Acceptance rule

Do not accept a visual or interaction implementation merely because it
renders. Before calling any stage finished, verify all six of:

- desktop viewport
- mobile viewport
- keyboard-only operation
- resize mid-state (state survives, layout adapts)
- `prefers-reduced-motion` respected
- no console errors

A stage that renders but fails any one of these six is not finished --- it's
untested.

## Harness notes

- `spec/assignment-1.test.ts` must test the eight-step core interaction
  invariant above, not a generic placeholder contract --- update it the
  moment the real markup exists, and don't leave the starter's
  `data-testid="interaction"` convention standing in for the real one.
- Ship optimised (resized, WebP) copies of the imagery in `assets/prod/`
  from `src/assets/img/` or `public/img/` --- never import the originals
  directly; they're multi-megabyte source renders, not shippable assets.
- `assets/ref_images/` and the originals in `assets/prod/` are reference
  material, not part of the deployed site --- don't let them get pulled into
  `dist/` by accident.
