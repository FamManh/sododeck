import { describe, expect, it } from 'vitest';

import { lineStyleView } from './line-style-view';

describe('lineStyleView', () => {
  it('reports the shared effective value, defaults included', () => {
    const view = lineStyleView([{}, { style: { dash: 'solid', width: 2 } }]);
    expect(view.dash.shared).toEqual({ mixed: false, value: 'solid' });
    expect(view.width.shared).toEqual({ mixed: false, value: 2 });
    expect(view.color.shared).toEqual({ mixed: false, value: null });
    expect(view.animated.shared).toEqual({ mixed: false, value: false });
    expect(view.shape.shared).toEqual({ mixed: false, value: 'curved' });
  });

  it('is mixed per key and lists the values in use', () => {
    const view = lineStyleView([
      { style: { dash: 'dashed', color: 'blue', shape: 'elbow' } },
      { style: { width: 3, color: 'blue' } },
      { route: { offset: 4 } },
    ]);
    expect(view.dash.shared).toEqual({ mixed: true });
    expect(view.dash.used).toEqual(['dashed', 'solid']);
    expect(view.width.used).toEqual([2, 3]);
    expect(view.color.used).toEqual(['blue', null]);
    expect(view.shape.used).toEqual(['elbow', 'curved']);
    expect(view.animated.shared).toEqual({ mixed: false, value: false });
  });

  it('is mixed for no connectors', () => {
    expect(lineStyleView([]).dash.shared).toEqual({ mixed: true });
  });
});
