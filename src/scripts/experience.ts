// Minimal, hand-written scene controller -- no framework, no router. The
// experience is one document; "moving forward" means swapping which .scene
// panel is visible/interactive, not a page navigation. Kept intentionally
// tiny: this is the first client-side JS in the project (see CLAUDE.md,
// "prefer the simplest architecture that satisfies the contract").
import { getBlackHole, setBlackHole, type BlackHoleType } from "../lib/state";

export function initExperience(): void {
  const root = document.querySelector<HTMLElement>('[data-testid="interaction-output"]');
  const beginButton = document.querySelector<HTMLButtonElement>('[data-testid="interaction"]');
  if (!root || !beginButton) return;

  const panels = root.querySelectorAll<HTMLElement>(".scene");

  function showScene(scene: string): void {
    if (!root) return;
    root.dataset.scene = scene;
    panels.forEach((panel) => {
      const isActive = panel.classList.contains(`scene-${scene}`);
      panel.setAttribute("aria-hidden", String(!isActive));
      if (isActive) {
        panel.removeAttribute("inert");
      } else {
        panel.setAttribute("inert", "");
      }
    });

    // Move focus into the new scene so keyboard and screen-reader users get
    // an explicit cue that the view changed -- nothing else announces it,
    // since there's no page load/title change to rely on.
    const heading = root.querySelector<HTMLElement>(`.scene-${scene} h1, .scene-${scene} h2`);
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }

  beginButton.addEventListener("click", () => showScene("selecting"));

  const blackHoleInputs = root.querySelectorAll<HTMLInputElement>('input[name="blackhole"]');
  const startDescentButton = root.querySelector<HTMLButtonElement>("#start-descent");
  const descentSummary = root.querySelector<HTMLElement>("#descent-summary");

  const descentCopy: Record<BlackHoleType, string> = {
    stellar: "Falling toward the stellar black hole. Tidal forces here are extreme.",
    supermassive: "Falling toward the supermassive black hole. Tidal forces here are much milder.",
  };

  blackHoleInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      const choice: BlackHoleType = input.value === "supermassive" ? "supermassive" : "stellar";
      setBlackHole(choice);
      if (startDescentButton) startDescentButton.disabled = false;
    });
  });

  startDescentButton?.addEventListener("click", () => {
    const choice = getBlackHole();
    if (descentSummary && choice) {
      descentSummary.textContent = descentCopy[choice];
    }
    showScene("descending");
  });
}

initExperience();
