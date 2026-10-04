import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startLandingMotion, timeOf } from './landing-motion';

type Callback = (entries: { isIntersecting: boolean; target: Element }[]) => void;

let observed: { callback: Callback; targets: Element[] }[] = [];

function mockMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce, media: query }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly entry: { callback: Callback; targets: Element[] };
      constructor(callback: Callback) {
        this.entry = { callback, targets: [] };
        observed.push(this.entry);
      }
      observe(target: Element) {
        this.entry.targets.push(target);
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

function page() {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="sdl-stage" data-motion="loop" id="hero"></div>
    <div class="sdl-stage" data-motion="once" id="flows">
      <button class="sdl-replay" hidden>Replay</button>
    </div>`;
  document.body.append(root);
  const get = (id: string) => {
    const el = root.querySelector<HTMLElement>(`#${id}`);
    if (el === null) throw new Error(id);
    return el;
  };
  return { root, hero: get('hero'), flows: get('flows') };
}

describe('startLandingMotion', () => {
  beforeEach(() => {
    observed = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('starts loops at once and play-once stages when they come into view', () => {
    mockMotion(false);
    const { root, hero, flows } = page();
    startLandingMotion(root);
    expect(hero).toHaveAttribute('data-play');
    expect(flows).not.toHaveAttribute('data-play');
    const io = observed[0];
    expect(io?.targets).toEqual([flows]);
    io?.callback([{ isIntersecting: true, target: flows }]);
    expect(flows).toHaveAttribute('data-play');
  });

  it('shows Replay and restarts the stage on click', () => {
    mockMotion(false);
    const { root, flows } = page();
    startLandingMotion(root);
    const replay = flows.querySelector('button');
    expect(replay).not.toBeNull();
    expect(replay?.hidden).toBe(false);
    replay?.click();
    expect(flows).toHaveAttribute('data-play');
  });

  it('plays nothing under reduced motion, so the final frames stay', () => {
    mockMotion(true);
    const { root, hero, flows } = page();
    startLandingMotion(root);
    expect(hero).not.toHaveAttribute('data-play');
    expect(flows.querySelector('button')?.hidden).toBe(true);
    expect(observed).toHaveLength(0);
  });
});

function playerPage() {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="sdl-stage" data-motion="once" data-end="5.4" data-steps="2:0 3:1.5 4:2.4 7:5.1">
      <button data-player="prev">Previous step</button>
      <button data-player="toggle" aria-label="Play">Play</button>
      <button data-player="next">Next step</button>
      <div data-step-row="2"></div><div data-step-row="3"></div><div data-step-row="7"></div>
      <button data-seek-step="2">Step 3</button>
      <button data-seek-step="3">Step 4</button>
      <button data-seek-step="7">Step 8</button>
      <button class="sdl-replay" hidden>Replay</button>
    </div>`;
  document.body.append(root);
  const stage = root.querySelector<HTMLElement>('.sdl-stage');
  if (stage === null) throw new Error('stage');
  const button = (selector: string) => {
    const el = stage.querySelector<HTMLButtonElement>(selector);
    if (el === null) throw new Error(selector);
    return el;
  };
  return { root, stage, button };
}

describe('the Flows player', () => {
  beforeEach(() => {
    observed = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('seeks to a step from its segment and holds the frame', () => {
    mockMotion(false);
    const { root, stage, button } = playerPage();
    startLandingMotion(root);
    button('[data-seek-step="3"]').click();
    expect(stage).toHaveAttribute('data-play');
    expect(stage).toHaveAttribute('data-paused');
    expect(stage.style.getPropertyValue('--sdl-seek')).toBe('1.7');
    expect(button('[data-seek-step="3"]')).toHaveAttribute('aria-current', 'step');
    expect(stage.querySelector('[data-step-row="3"]')).not.toHaveAttribute('aria-hidden');
    expect(stage.querySelector('[data-step-row="2"]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('steps forward and back, and lands on the final frame at the end', () => {
    mockMotion(false);
    const { root, stage, button } = playerPage();
    startLandingMotion(root);
    button('[data-seek-step="2"]').click();
    button('[data-player="next"]').click();
    expect(timeOf(stage)).toBeCloseTo(1.7);
    button('[data-player="next"]').click();
    button('[data-player="next"]').click();
    expect(timeOf(stage)).toBe(5.4);
    button('[data-player="prev"]').click();
    expect(timeOf(stage)).toBeCloseTo(2.6);
  });

  it('plays from a held frame, pauses, and restarts after the end', () => {
    mockMotion(false);
    const { root, stage, button } = playerPage();
    startLandingMotion(root);
    const toggle = button('[data-player="toggle"]');
    button('[data-seek-step="3"]').click();
    toggle.click();
    expect(stage).not.toHaveAttribute('data-paused');
    expect(toggle).toHaveAttribute('aria-label', 'Pause');
    toggle.click();
    expect(stage).toHaveAttribute('data-paused');
    expect(toggle).toHaveAttribute('aria-label', 'Play');
    button('[data-seek-step="7"]').click();
    toggle.click();
    expect(stage.style.getPropertyValue('--sdl-seek')).toBe('0');
    expect(stage).not.toHaveAttribute('data-paused');
  });

  it('steps through still frames under reduced motion', () => {
    mockMotion(true);
    const { root, stage, button } = playerPage();
    startLandingMotion(root);
    expect(stage).not.toHaveAttribute('data-play');
    const toggle = button('[data-player="toggle"]');
    toggle.click();
    expect(stage).toHaveAttribute('data-paused');
    expect(timeOf(stage)).toBeCloseTo(0.2);
    toggle.click();
    expect(timeOf(stage)).toBeCloseTo(1.7);
  });
});
