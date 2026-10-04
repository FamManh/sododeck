import { toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { actionContext, actionDeck, sel } from '../../test/action-fixtures';
import { actionsFor } from './actions-for';
import { ACTIONS } from './index';

const table = (id: string, y: number, detail?: 'names' | 'keys' | 'all') => ({
  id,
  type: 'db-table',
  title: id,
  position: { x: 0, y },
  columns: [{ id: `${id}-id`, name: 'id', type: 'int', pk: true }],
  ...(detail === undefined ? {} : { detail }),
});

const deck = {
  ...actionDeck,
  nodes: [...actionDeck.nodes, table('t1', 900), table('t2', 1200, 'all'), table('t3', 1500)],
};

const contextFor = (ids: string[]) =>
  actionContext(
    { kind: ids.length === 1 ? 'component' : 'components', ids: sel({ nodes: ids }) },
    'edit',
    deck,
  );

const detailAction = (ctx: ReturnType<typeof contextFor>, surface: 'menu' | 'toolbar') =>
  actionsFor(ACTIONS, ctx, surface)
    .flatMap((s) => s.actions)
    .find((a) => a.id === 'table.detail');

const detailOf = (ctx: ReturnType<typeof contextFor>, id: string) =>
  toJSON(ctx.doc).nodes.find((n) => n.id === id)?.detail;

describe('table.detail (041 FR-015)', () => {
  it('is a radio submenu offered only when every target is a table', () => {
    const one = detailAction(contextFor(['t1']), 'menu');
    expect(one?.label).toBe('Detail');
    expect(one?.children?.map((c) => [c.label, c.checked])).toEqual([
      ['Use deck setting', true],
      ['Names', false],
      ['Keys', false],
      ['All', false],
    ]);
    expect(detailAction(contextFor(['a']), 'menu')).toBeUndefined();
    expect(detailAction(contextFor(['a', 't1']), 'menu')).toBeUndefined();
  });

  it('names the shared choice in the toolbar, or Mixed', () => {
    expect(detailAction(contextFor(['t2']), 'toolbar')?.label).toBe('Detail: All');
    expect(detailAction(contextFor(['t1', 't3']), 'toolbar')?.label).toBe('Detail: Deck');
    expect(detailAction(contextFor(['t1', 't2']), 'toolbar')?.label).toBe('Detail: Mixed');
  });

  it('sets every selected table in one undo step; Use deck setting removes the key', () => {
    const ctx = contextFor(['t1', 't2', 't3']);
    const choose = (id: string) => {
      detailAction(ctx, 'menu')
        ?.children?.find((c) => c.id === id)
        ?.run();
    };
    choose('table.detail.keys');
    expect(['t1', 't2', 't3'].map((id) => detailOf(ctx, id))).toEqual(['keys', 'keys', 'keys']);
    expect(ctx.editor.undo()).toBe(true);
    expect(['t1', 't2', 't3'].map((id) => detailOf(ctx, id))).toEqual([
      undefined,
      'all',
      undefined,
    ]);
    choose('table.detail.deck');
    expect(['t1', 't2', 't3'].map((id) => detailOf(ctx, id))).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});
