import { describe, expect, it } from 'vitest';

import { currentViewCrumb, viewCrumbTitle, viewTabName } from './view-title';

describe('view titles (011)', () => {
  it('names the crumb "<title> view" and the tab "<title>, <type> view"', () => {
    expect(viewCrumbTitle({ title: 'Checkout path' })).toBe('Checkout path view');
    expect(viewTabName({ title: 'Infra', type: 'infra' })).toBe('Infra, infra view');
  });

  it('finds the current view, falling back to the first (the presets when none are stored)', () => {
    expect(currentViewCrumb([], null)).toBe('System view');
    expect(currentViewCrumb(undefined, 'infra')).toBe('Infra view');
    const views = [{ id: 'v', type: 'custom' as const, title: 'Mine' }];
    expect(currentViewCrumb(views, 'gone')).toBe('Mine view');
  });
});
