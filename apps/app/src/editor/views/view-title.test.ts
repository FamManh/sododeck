import { describe, expect, it } from 'vitest';

import { currentViewCrumb, viewCrumbTitle, viewTabName } from './view-title';

describe('view titles (011)', () => {
  it('names the crumb "<title> view" and a custom tab "<title>, <type> view"', () => {
    expect(viewCrumbTitle({ title: 'Checkout path' })).toBe('Checkout path view');
    expect(viewTabName({ id: 'v2', title: 'Infra', type: 'infra' })).toBe('Infra, infra view');
  });

  it('names the built-in Overview and Flows tabs "<title> view" (054)', () => {
    expect(viewTabName({ id: 'system', title: 'Overview', type: 'system' })).toBe('Overview view');
    expect(viewTabName({ id: 'feature', title: 'Flows', type: 'feature' })).toBe('Flows view');
    expect(viewTabName({ id: 'x', title: 'Overview', type: 'custom' })).toBe(
      'Overview, custom view',
    );
  });

  it('finds the current view, falling back to the first (the presets when none are stored)', () => {
    expect(currentViewCrumb([], null)).toBe('Overview view');
    expect(currentViewCrumb(undefined, 'feature')).toBe('Flows view');
    const views = [{ id: 'v', type: 'custom' as const, title: 'Mine' }];
    expect(currentViewCrumb(views, 'gone')).toBe('Mine view');
  });
});
