// @vitest-environment node
import { toJSON } from '@sododeck/model';
import type { Node } from '@sododeck/schema';
import ELK from 'elkjs/lib/elk.bundled.js';
import { describe, expect, it } from 'vitest';

import { computeLayout } from '../../layout/elk-layout';
import { actionContext, labels, sel } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
import { arrangeSelectedTables } from './arrange-tables-actions';

const elk = new ELK();
const table = (id: string, y: number, locked = false): Node => ({
  id,
  type: 'db-table',
  title: id,
  position: { x: 0, y },
  columns: [
    { id: `${id}-id`, name: 'id', type: 'uuid', pk: true },
    { id: `${id}-ref`, name: 'ref_id', type: 'uuid' },
  ],
  ...(locked ? { locked: true } : {}),
});
const fk = (id: string, child: string, parent: string) => ({
  id,
  from: child,
  to: parent,
  fromColumns: [`${child}-ref`],
  toColumns: [`${parent}-id`],
  cardinality: 'n-1' as const,
});
// Stacked in one column, as a paste used to leave them.
const file = deckOf({
  nodes: [table('users', 0), table('orders', 300), table('items', 600), table('fixed', 900, true)],
  edges: [fk('o-u', 'orders', 'users'), fk('i-o', 'items', 'orders'), fk('f-u', 'fixed', 'users')],
});
const target = (ids: string[]) => ({ kind: 'components' as const, ids: sel({ nodes: ids }) });

describe('Arrange tables', () => {
  it('lays the selected tables out left to right by relationship, in one undo step', async () => {
    const ctx = actionContext(target(['users', 'orders', 'items', 'fixed']), 'edit', file);
    const moved = await arrangeSelectedTables(ctx, (request) => computeLayout(request, elk));
    expect(moved).toBe(3);
    const at = (id: string) => toJSON(ctx.doc).nodes.find((n) => n.id === id)?.position;
    expect(at('users')?.x).toBeLessThan(at('orders')?.x ?? -Infinity);
    expect(at('orders')?.x).toBeLessThan(at('items')?.x ?? -Infinity);
    expect(at('fixed')).toEqual({ x: 0, y: 900 });
    expect(ctx.editor.undo()).toBe(true);
    expect(toJSON(ctx.doc)).toEqual(toJSON(actionContext(target([]), 'edit', file).doc));
  });

  it('moves nothing when the layout fails', async () => {
    const ctx = actionContext(target(['users', 'orders']), 'edit', file);
    expect(await arrangeSelectedTables(ctx, () => Promise.reject(new Error('x')))).toBe(0);
    expect(ctx.editor.canUndo()).toBe(false);
  });

  it('is offered for two or more tables only', () => {
    expect(labels(target(['users', 'orders']), 'menu', 'edit', file).flat()).toContain(
      'Arrange tables',
    );
    expect(labels(target(['users']), 'menu', 'edit', file).flat()).not.toContain('Arrange tables');
  });
});
