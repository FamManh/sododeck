/**
 * Plays the landing page animations (see components/landing/stage.tsx). A stage animates only
 * while it has `data-play`: loops start at once, play-once stages when 35 % of them is in view.
 * Under reduced motion nothing plays and the final frames stay.
 */
const PLAY = 'data-play';

function play(stage: HTMLElement) {
  // Removing and re-adding the attribute after a reflow restarts every animation in the stage.
  stage.removeAttribute(PLAY);
  stage.getBoundingClientRect();
  stage.setAttribute(PLAY, '');
}

export function startLandingMotion(root: ParentNode = document): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stages = [...root.querySelectorAll<HTMLElement>('.sdl-stage')];
  const once = stages.filter((stage) => stage.dataset.motion === 'once');
  for (const stage of stages) {
    if (stage.dataset.motion === 'loop') play(stage);
  }
  if (once.length === 0) return;
  for (const stage of once) {
    const replay = stage.querySelector<HTMLButtonElement>('.sdl-replay');
    if (replay === null) continue;
    replay.hidden = false;
    replay.addEventListener('click', () => {
      play(stage);
    });
  }
  if (!('IntersectionObserver' in window)) {
    once.forEach(play);
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        play(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.35 },
  );
  once.forEach((stage) => {
    observer.observe(stage);
  });
}
