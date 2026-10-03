import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startLandingMotion } from './landing-motion';

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
