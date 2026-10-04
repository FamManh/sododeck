/**
 * Plays the landing page animations (see components/landing/stage.tsx). A stage animates only
 * while it has `data-play`; `--sdl-seek` (seconds) shifts its timeline and `data-paused` holds it.
 * Loops start at once, play-once stages when 35 % of them is in view. Under reduced motion
 * nothing plays by itself; the Flows player can still step through still frames.
 */
import {
  nextStep,
  parseSteps,
  prevStep,
  seekTime,
  stepAt,
  type SeekStep,
} from '../lib/landing/seek';

interface Clock {
  /** Timeline position when the stage was last (re)started, in seconds. */
  base: number;
  /** `performance.now()` at that moment. */
  startedAt: number;
  paused: boolean;
  /** Ends a play: the player shows Play again. */
  timer?: number;
}

const clocks = new WeakMap<HTMLElement, Clock>();

const endOf = (stage: HTMLElement): number => Number(stage.dataset.end ?? '0') || 0;

/** Where the stage's timeline is now. */
export function timeOf(stage: HTMLElement): number {
  const clock = clocks.get(stage);
  if (clock === undefined) return endOf(stage);
  if (clock.paused) return clock.base;
  return Math.min(endOf(stage), clock.base + (performance.now() - clock.startedAt) / 1000);
}

function syncPlayer(stage: HTMLElement, steps: readonly SeekStep[], t: number, paused: boolean) {
  const toggle = stage.querySelector<HTMLButtonElement>('[data-player="toggle"]');
  toggle?.setAttribute('aria-label', paused ? 'Play' : 'Pause');
  const current = stepAt(steps, t);
  if (current === undefined) return;
  for (const row of stage.querySelectorAll<HTMLElement>('[data-step-row]')) {
    if (Number(row.dataset.stepRow) === current.index) row.removeAttribute('aria-hidden');
    else row.setAttribute('aria-hidden', 'true');
  }
  for (const segment of stage.querySelectorAll<HTMLElement>('[data-seek-step]')) {
    if (Number(segment.dataset.seekStep) === current.index)
      segment.setAttribute('aria-current', 'step');
    else segment.removeAttribute('aria-current');
  }
}

/** Shows the timeline at `t`, held (`paused`) or playing on from there. */
export function seek(stage: HTMLElement, t: number, paused: boolean): void {
  const end = endOf(stage);
  const previous = clocks.get(stage);
  if (previous?.timer !== undefined) window.clearTimeout(previous.timer);
  stage.style.setProperty('--sdl-seek', String(t));
  stage.toggleAttribute('data-paused', paused);
  // Removing and re-adding `data-play` after a reflow restarts every animation from `t`.
  stage.removeAttribute('data-play');
  stage.getBoundingClientRect();
  stage.setAttribute('data-play', '');
  const clock: Clock = { base: t, startedAt: performance.now(), paused };
  const steps = parseSteps(stage.dataset.steps);
  if (!paused && stage.dataset.motion === 'once') {
    clock.timer = window.setTimeout(
      () => {
        clocks.set(stage, { base: end, startedAt: performance.now(), paused: true });
        stage.setAttribute('data-paused', '');
        syncPlayer(stage, steps, end, true);
      },
      Math.max(0, end - t) * 1000,
    );
  }
  clocks.set(stage, clock);
  syncPlayer(stage, steps, t, paused);
}

function wirePlayer(stage: HTMLElement, reduce: boolean) {
  const steps = parseSteps(stage.dataset.steps);
  if (steps.length === 0) return;
  const end = endOf(stage);
  const go = (step: SeekStep | undefined) => {
    if (step !== undefined) seek(stage, seekTime(steps, step, end), true);
  };
  stage.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (target === null || !stage.contains(target)) return;
    const action = target.dataset.player;
    const t = timeOf(stage);
    if (action === 'prev') go(prevStep(steps, t));
    else if (action === 'next') go(nextStep(steps, t));
    else if (action === 'toggle') {
      const clock = clocks.get(stage);
      const paused = clock === undefined || clock.paused;
      // Without motion "play" steps forward instead of animating, from the first step after the end.
      if (reduce) go(t >= end - 1e-3 ? steps[0] : nextStep(steps, t));
      else if (!paused) seek(stage, t, true);
      else seek(stage, t >= end - 1e-3 ? 0 : t, false);
    } else if (target.dataset.seekStep !== undefined) {
      go(steps.find((s) => s.index === Number(target.dataset.seekStep)));
    }
  });
}

export function startLandingMotion(root: ParentNode = document): void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stages = [...root.querySelectorAll<HTMLElement>('.sdl-stage')];
  for (const stage of stages) wirePlayer(stage, reduce);
  if (reduce) return;
  const once = stages.filter((stage) => stage.dataset.motion === 'once');
  for (const stage of stages) {
    if (stage.dataset.motion === 'loop') seek(stage, 0, false);
  }
  if (once.length === 0) return;
  for (const stage of once) {
    const replay = stage.querySelector<HTMLButtonElement>('.sdl-replay');
    if (replay === null) continue;
    replay.hidden = false;
    replay.addEventListener('click', () => {
      seek(stage, 0, false);
    });
  }
  if (!('IntersectionObserver' in window)) {
    for (const stage of once) seek(stage, 0, false);
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const stage = entry.target as HTMLElement;
        // A visitor who already used the player keeps their frame.
        if (!clocks.has(stage)) seek(stage, 0, false);
        observer.unobserve(stage);
      }
    },
    { threshold: 0.35 },
  );
  for (const stage of once) observer.observe(stage);
}
