import { toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { actionContext, sel } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
import { applyStyle } from '../style/apply-style';
import { actionsFor, runAction } from './actions-for';
import { alignSelection } from './align-actions';
import { ACTIONS } from './index';

const table = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'db-table',
  title: id,
  position: { x, y },
  columns: [{ id: `${id}.id`, name: 'id', type: 'int', pk: true }],
  ...extra,
});

const deck = deckOf({
  nodes: [table('products', 0, 0), table('categories', 400, 80), table('brands', 800, 160)],
});
const target = {
  kind: 'components' as const,
  ids: sel({ nodes: ['products', 'categories', 'brands'] }),
};

describe('editing several tables at once (043 US7, FR-025)', () => {
  it('sets the colour of all of them, undone by one ⌘Z', () => {
    const ctx = actionContext(target, 'edit', deck);
    applyStyle(ctx.editor, ctx.selection, 'fill', 'teal');
    expect(toJSON(ctx.doc).nodes.every((n) => n.style?.fill === 'teal')).toBe(true);
    ctx.editor.undo();
    expect(toJSON(ctx.doc).nodes.every((n) => n.style === undefined)).toBe(true);
  });

  it('sets the detail of all of them, undone by one ⌘Z', () => {
    const ctx = actionContext(target, 'edit', deck);
    const detail = actionsFor(ACTIONS, ctx, 'toolbar')
      .flatMap((s) => s.actions)
      .find((a) => a.id === 'table.detail');
    detail?.children?.find((c) => c.label === 'Keys')?.run();
    expect(toJSON(ctx.doc).nodes.map((n) => n.detail)).toEqual(['keys', 'keys', 'keys']);
    ctx.editor.undo();
    expect(toJSON(ctx.doc).nodes.map((n) => n.detail)).toEqual([undefined, undefined, undefined]);
  });

  it('groups them in one step', () => {
    const ctx = actionContext(target, 'edit', deck);
    expect(runAction(ACTIONS, 'group.create', ctx)).toBe(true);
    expect(toJSON(ctx.doc).nodes.every((n) => n.group !== undefined)).toBe(true);
    ctx.editor.undo();
    expect(toJSON(ctx.doc).groups).toEqual([]);
  });

  it('aligns them in one step, leaving a locked table where it is', () => {
    const locked = deckOf({
      nodes: [
        table('products', 0, 0),
        table('categories', 400, 80, { locked: true }),
        table('brands', 800, 160),
      ],
    });
    const ctx = actionContext(target, 'edit', locked);
    alignSelection(ctx, 'top');
    const ys = toJSON(ctx.doc).nodes.map((n) => n.position?.y);
    expect(ys).toEqual([0, 80, 0]);
    ctx.editor.undo();
    expect(toJSON(ctx.doc).nodes.map((n) => n.position?.y)).toEqual([0, 80, 160]);
  });
});
