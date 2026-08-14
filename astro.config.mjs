import { defineConfig } from "astro/config";

// The deployed site lives under github.io/<repo>/, so the base path has to be
// set explicitly — see CLAUDE.md, "the stack is swappable".
export default defineConfig({
  base: "/comp4020-ass1-Adithya-Rama",
});
