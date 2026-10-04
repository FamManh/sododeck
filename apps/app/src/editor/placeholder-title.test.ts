import { describe, expect, it } from 'vitest';

import { placeholderTitle, shownShapeTitle } from './placeholder-title';

describe('placeholderTitle', () => {
  it('is "Untitled <type name>" in lower case', () => {
    expect(placeholderTitle('service')).toBe('Untitled service');
    expect(placeholderTitle('diamond')).toBe('Untitled diamond');
  });
});

describe('shownShapeTitle', () => {
  it('draws nothing while a shape keeps its placeholder', () => {
    expect(shownShapeTitle({ type: 'diamond', title: 'Untitled diamond' }, 'diamond')).toBe('');
  });

  it('draws any other title, including one that only looks alike', () => {
    expect(shownShapeTitle({ type: 'diamond', title: 'Payment OK?' }, 'diamond')).toBe(
      'Payment OK?',
    );
    expect(shownShapeTitle({ type: 'diamond', title: 'Untitled service' }, 'diamond')).toBe(
      'Untitled service',
    );
  });

  it('keeps the placeholder on the text shape, which is only its words', () => {
    expect(shownShapeTitle({ type: 'text', title: 'Untitled text' }, 'none')).toBe('Untitled text');
  });
});
