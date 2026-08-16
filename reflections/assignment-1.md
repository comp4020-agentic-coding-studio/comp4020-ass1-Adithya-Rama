# Assignment 1 --- FALL

## What was the breakthrough that moved the work forward?

For the first eleven scenes I built, the mobile layout was just the desktop
layout, shrunk. The sync and fall stages carried a HUD readout (clocks,
distance-to-horizon, signal status) *and* decorative illustration --- an
astronaut's arm, a falling hand, a stacked-astronaut silhouette --- side by
side, on the unexamined assumption that atmosphere mattered as much as the
data.

A 390px viewport made that assumption impossible to keep denying: the phone
reference in `assets/ref_images/` had no room for both. Forced to choose, I
had the agent drop the decorative art on mobile entirely (`display: none` on
`.sync-astronaut-arm`, `.fall-hand`, `.fall-astronaut-stack`) and rebuild
sync/fall as a denser two-column grid of readouts instead
([`1a84e36`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-Adithya-Rama/commit/1a84e36)).
Nothing about the idea --- two clocks diverging, a signal dying in transit
--- was lost. If anything, the mobile version reads it faster: the
illustration had never been carrying any of it.

That's the breakthrough: the art was decoration, not explanation, and I
hadn't noticed because desktop had room to hide the difference. It's still
there on desktop today, undisturbed --- I haven't gone back to justify it the
same way, which is the honest boundary of what actually changed.

## What did this work change about who I want to be as a developer?

It reset how I direct the agent afterward. At the final visual-crit pass I
told it explicitly not to add UI to fix a cosmetic-looking overlap, and
instead of reaching for a decorative scrim it measured the real DOM and
reported a false alarm. I'm learning to ask "does this change what a visitor
understands" before "does this look good" --- of the model's suggestions, and
of my own instructions to it.
