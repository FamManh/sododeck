import { toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { actionContext, sel, TARGETS } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
import { alignSelection } from './align-actions';

describe('alignSelection (016 R12, 017 R2)', () => {
  it('aligns right edges using each card’s own size, not a fixed level size', () => {
    const file = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
        {
          id: 'b',
          type: 'service',
          title: 'B',
          position: { x: 1000, y: 0 },
          size: { width: 300, height: 100 },
        },
      ],
    });
    const ctx = actionContext(
      { kind: 'components', ids: sel({ nodes: ['a', 'b'] }) },
      'edit',
      file,
    );
    expect(alignSelection(ctx, 'right')).toBe(true);
    // Right edge is 1000 + 300 = 1300; a (default width 164) lands at 1300 - 164.
    expect(toJSON(ctx.doc).nodes.find((n) => n.id === 'a')?.position).toEqual({
      x: 1300 - 164,
      y: 0,
    });
  });

  it('is available for the two-component target', () => {
    const ctx = actionContext(TARGETS.components);
    expect(alignSelection(ctx, 'left')).toBe(true);
  });
});
