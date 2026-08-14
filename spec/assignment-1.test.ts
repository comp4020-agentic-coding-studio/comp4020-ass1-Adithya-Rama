import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Assignment 1's spec: https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/assignment-1/
//
// Only the mechanically checkable lines get a test here:
//   - "deployed and live at its public GitHub Pages URL by the deadline"
//     -> the CI `deploy`/"online" job checks this, not a local test.
//   - "static and client-side throughout, and the starter's invariant checks
//     pass" -> covered by a static build existing (build step) and
//     spec/invariants.test.ts staying green.
//   - "it works at both marking viewports (desktop and phone)" -> judged live
//     by a person at the crit, not something a build-output test can assert.
//   - "one strong idea with a point of view, and nothing else" -> judged.
//
// The one line worth a contract test: "the visitor does something that
// changes what they see." The convention below (`data-testid="interaction"` /
// `data-testid="interaction-output"`) is this repo's own hook for that
// contract — wire the real prototype's markup to it once the idea is chosen.
// This starts red on purpose: there's no prototype yet.

const NEXT_STEP =
  "Wire your core interaction to [data-testid='interaction'] (the control) and [data-testid='interaction-output'] (what it changes), or edit this test to match your own markup.";

describe("assignment 1: core interaction", () => {
  it("has a control that changes what the visitor sees", () => {
    const distPath = resolve("dist/index.html");
    expect(existsSync(distPath), `${distPath} not found — run pnpm build first.`).toBe(true);

    const doc = new JSDOM(readFileSync(distPath, "utf8")).window.document;

    const control = doc.querySelector('[data-testid="interaction"]');
    expect(control, NEXT_STEP).toBeTruthy();

    const output = doc.querySelector('[data-testid="interaction-output"]');
    expect(output, NEXT_STEP).toBeTruthy();
  });
});
