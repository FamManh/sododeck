import { toJSON } from '@sododeck/model';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, sel } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
import { actionsFor, runAction } from './actions-for';
import { ACTIONS } from './index';
import type { MenuTarget } from '../../state/ui-store';

const file = deckOf({
  groupingMode: 'schema',
  nodes: [
    { id: 'p', type: 'db-table', title: 'payments', schema: 'billing', position: { x: 0, y: 0 } },
    { id: 'i', type: 'db-table', title: 'invoices', schema: 'billing', position: { x: 400, y: 0 } },
    { id: 'u', type: 'db-table', title: 'users', schema: 'auth', position: { x: 0, y: 400 } },
  ],
  views: [{ id: 'v', type: 'custom', title: 'V' }],
});
const target: MenuTarget = { kind: 'group', ids: sel({ groups: ['schema:billing'] }) };

beforeEach(() => {
  useUiStore.getState().resetForDeck();
  useUiStore.setState({ currentViewId: 'v' });
});

describe('actions on a derived schema group (048)', () => {
  it('offers Collapse and Select members, never Ungroup, Delete group or Rename', () => {
    const ctx = actionContext(target, 'edit', file);
    const labels = actionsFor(ACTIONS, ctx, 'menu').flatMap((s) => s.actions.map((a) => a.label));
    expect(labels).toContain('Collapse');
    expect(labels).toContain('Select members');
    for (const hidden of ['Ungroup', 'Delete group', 'Rename'])
      expect(labels).not.toContain(hidden);
  });

  it('collapses into the view list, selects its tables, and keeps every table stored', () => {
    const ctx = actionContext(target, 'edit', file);
    expect(runAction(ACTIONS, 'group.collapse', ctx)).toBe(true);
    expect(toJSON(ctx.doc).views.find((v) => v.id === 'v')?.collapsed).toEqual(['schema:billing']);
    expect(toJSON(ctx.doc).nodes.map((n) => n.id)).toEqual(['p', 'i', 'u']);
    expect(toJSON(ctx.doc).groups).toEqual([]);
    expect(useUiStore.getState().announcement.text).toBe('billing collapsed');

    expect(runAction(ACTIONS, 'group.selectMembers', actionContext(target, 'edit', file))).toBe(
      true,
    );
    expect(useUiStore.getState().selection.nodes).toEqual(['p', 'i']);
  });

  it('refuses to rename a derived group', () => {
    expect(
      useUiStore.getState().startTitleEdit({ target: 'group', id: 'schema:billing', isNew: false }),
    ).toBe(false);
    expect(useUiStore.getState().titleEdit).toBeNull();
  });
});
