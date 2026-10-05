import { toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { deckOf, editorWrapper } from '../test/render-canvas';
import { actionContext, sel } from '../test/action-fixtures';
import { alignSelection } from './actions/align-actions';
import { Canvas } from './canvas';
import { connectColumns } from './canvas-actions';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { actionsFor } from './actions/actions-for';
import { ACTIONS } from './actions/index';
import {
  groupLockState,
  isEdgeLocked,
  isGroupLocked,
  isStickyLocked,
  LOCKED_HINT,
  lockableIds,
  unlockedIds,
  unlockedOf,
  withoutLocked,
} from './lock';
import { useEditorShortcuts } from './use-canvas-shortcuts';

const table = (id: string, x: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'db-table',
  title: id,
  position: { x, y: 0 },
  columns: [
    { id: `${id}.id`, name: 'id', type: 'int', pk: true },
    { id: `${id}.ref`, name: 'ref', type: 'int' },
  ],
  ...extra,
});

const deck = deckOf({
  nodes: [
    table('payments', 0, { locked: true }),
    table('orders', 400),
    { id: 'svc', type: 'service', title: 'Billing', position: { x: 0, y: 400 } },
  ],
});

const ui = () => useUiStore.getState();

function Editor() {
  useEditorShortcuts();
  const snapshot = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <Canvas />
      <ConfirmDeleteDialog deck={snapshot} />
    </>
  );
}

function setup(file: SododeckFile = deck) {
  const env = editorWrapper(file);
  render(<Editor />, { wrapper: env.wrapper });
  return { ...env, user: userEvent.setup() };
}

function focusCard(id: string) {
  act(() => {
    ui().select({ nodes: [id] });
    ui().focus(id);
  });
  act(() => {
    document.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus();
  });
}

const groupedDeck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'outer', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', group: 'inner', position: { x: 100, y: 0 } },
    {
      id: 'c',
      type: 'service',
      title: 'C',
      group: 'inner',
      locked: true,
      position: { x: 200, y: 0 },
    },
    { id: 'd', type: 'service', title: 'D', position: { x: 300, y: 0 } },
  ],
  groups: [
    { id: 'outer', title: 'Outer' },
    { id: 'inner', title: 'Inner', parent: 'outer' },
    { id: 'empty', title: 'Empty' },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b' }],
  stickies: [{ id: 's', text: 'Note', position: { x: 0, y: 400 } }],
});

describe('withoutLocked skips locked groups (054)', () => {
  it('drops a fully locked group from the targets and counts it', () => {
    const everyone = deckOf({
      ...groupedDeck,
      nodes: groupedDeck.nodes.map((n) => ({ ...n, locked: true as const })),
    });
    const result = withoutLocked(everyone, [
      { scope: 'groups', id: 'inner' },
      { scope: 'groups', id: 'empty' },
    ]);
    expect(result.targets).toEqual([{ scope: 'groups', id: 'empty' }]);
    expect(result.skipped).toBe(1);
    expect(withoutLocked(groupedDeck, [{ scope: 'groups', id: 'inner' }]).skipped).toBe(0);
  });
});

describe('group lock helpers (054, research R5)', () => {
  const none = { nodes: [], edges: [], groups: [], stickies: [] };

  it('lockableIds is the selected cards plus the cards of selected groups, once each', () => {
    expect(lockableIds(groupedDeck, { ...none, nodes: ['d'], groups: ['inner'] }).sort()).toEqual([
      'b',
      'c',
      'd',
    ]);
    expect(
      lockableIds(groupedDeck, { ...none, nodes: ['b'], groups: ['outer', 'inner'] }).sort(),
    ).toEqual(['a', 'b', 'c']);
  });

  it('lockableIds ignores selected notes, connectors and unknown ids', () => {
    const selection = {
      nodes: ['d', 'ghost'],
      edges: ['e'],
      groups: ['empty'],
      stickies: ['s'],
    };
    expect(lockableIds(groupedDeck, selection)).toEqual(['d']);
  });

  it('groupLockState: locked when every member is, unlocked when any is not, empty without cards', () => {
    expect(groupLockState(groupedDeck, 'outer')).toBe('unlocked');
    expect(groupLockState(groupedDeck, 'empty')).toBe('empty');
    expect(groupLockState(groupedDeck, 'nope')).toBe('empty');
    const allLocked = deckOf({
      ...groupedDeck,
      nodes: groupedDeck.nodes.map((n) => ({ ...n, locked: true as const })),
    });
    expect(groupLockState(allLocked, 'outer')).toBe('locked');
    expect(groupLockState(allLocked, 'inner')).toBe('locked');
  });

  it('isGroupLocked is false for an empty group, and a card added later unlocks the reading', () => {
    expect(isGroupLocked(groupedDeck, 'empty')).toBe(false);
    const locked = deckOf({
      ...groupedDeck,
      nodes: groupedDeck.nodes.map((n) => ({ ...n, locked: true as const })),
    });
    expect(isGroupLocked(locked, 'inner')).toBe(true);
    const grown = {
      ...locked,
      nodes: [
        ...locked.nodes,
        { id: 'new', type: 'service', title: 'New', group: 'inner', position: { x: 0, y: 0 } },
      ],
    } as SododeckFile;
    expect(isGroupLocked(grown, 'inner')).toBe(false);
  });
});

describe('lock helpers (043 R11)', () => {
  it('splits locked ids and delete targets from the others', () => {
    expect(unlockedOf(deck, ['payments', 'orders'])).toEqual({ ids: ['orders'], skipped: 1 });
    expect(
      withoutLocked(deck, [
        { scope: 'nodes', id: 'payments' },
        { scope: 'nodes', id: 'orders' },
        { scope: 'edges', id: 'e' },
      ]),
    ).toEqual({
      targets: [
        { scope: 'nodes', id: 'orders' },
        { scope: 'edges', id: 'e' },
      ],
      skipped: 1,
    });
  });
});

describe('a locked card on the canvas (043 US6)', () => {
  it('shows a lock badge that unlocks it, and no resize handles when selected', async () => {
    const { user, doc } = setup();
    act(() => {
      ui().select({ nodes: ['payments'] });
    });
    expect(screen.getByRole('group', { name: /^Table payments.*locked/ })).toBeInTheDocument();
    expect(document.querySelector('[data-node-id="payments"] .sd-resize-handle')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Unlock payments' }));
    expect(toJSON(doc).nodes[0]).not.toHaveProperty('locked');
  });

  it('locks and unlocks the selection with ⇧⌘L', async () => {
    const { user, doc } = setup();
    focusCard('svc');
    await user.keyboard('{Control>}{Shift>}l{/Shift}{/Control}');
    expect(toJSON(doc).nodes.find((n) => n.id === 'svc')?.locked).toBe(true);
    await user.keyboard('{Control>}{Shift>}l{/Shift}{/Control}');
    expect(toJSON(doc).nodes.find((n) => n.id === 'svc')).not.toHaveProperty('locked');
  });

  it('refuses rename, column keys, nudge and resize keys, saying why', async () => {
    const { user, doc } = setup();
    const before = JSON.stringify(toJSON(doc));
    focusCard('payments');
    await user.keyboard('{F2}');
    expect(ui().titleEdit).toBeNull();
    expect(ui().announcement.text).toBe(LOCKED_HINT);
    await user.keyboard('c');
    expect(ui().columnEdit).toBeNull();
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await user.keyboard('{Control>}{Shift>}{ArrowRight}{/Shift}{/Control}');
    focusCard('payments');
    await user.keyboard('{ArrowDown}');
    expect(ui().focusedRow?.tableId).toBe('payments');
    await user.keyboard('{Backspace}');
    await user.keyboard('{Enter}');
    expect(ui().columnEdit).toBeNull();
    expect(JSON.stringify(toJSON(doc))).toBe(before);
  });

  it('refuses the title edit on double-click', () => {
    setup();
    const card = document.querySelector('[data-node-id="payments"]');
    if (card === null) throw new Error('card not drawn');
    fireEvent.doubleClick(card);
    expect(ui().titleEdit).toBeNull();
  });

  it('deletes only the unlocked cards of a selection, saying how many were skipped', async () => {
    const { user, doc } = setup();
    act(() => {
      ui().select({ nodes: ['payments', 'orders'] });
    });
    await user.keyboard('{Delete}');
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['payments', 'svc']);
    expect(ui().announcement.text).toMatch(/· Skipped 1 locked$/);
  });

  it('never deletes a locked card alone', async () => {
    const { user, doc } = setup();
    act(() => {
      ui().select({ nodes: ['payments'] });
    });
    await user.keyboard('{Delete}');
    expect(toJSON(doc).nodes).toHaveLength(3);
    expect(ui().announcement.text).toBe('Skipped 1 locked · unlock to delete');
  });
});

describe('what a lock still allows (043 FR-023)', () => {
  it('takes a new relationship on a locked table’s row', () => {
    const env = editorWrapper(deck);
    render(<Canvas />, { wrapper: env.wrapper });
    connectColumns(
      env.editor(),
      { tableId: 'orders', columnId: 'orders.ref' },
      { tableId: 'payments', columnId: 'payments.id' },
    );
    expect(toJSON(env.doc).edges).toEqual([
      expect.objectContaining({ from: 'orders', to: 'payments' }),
    ]);
  });

  it('leaves a locked card out of align', () => {
    const ctx = actionContext(
      { kind: 'components', ids: sel({ nodes: ['payments', 'orders', 'svc'] }) },
      'edit',
      deck,
    );
    alignSelection(ctx, 'top');
    const nodes = toJSON(ctx.doc).nodes;
    expect(nodes.find((n) => n.id === 'payments')?.position).toEqual({ x: 0, y: 0 });
    expect(nodes.find((n) => n.id === 'svc')?.position?.y).toBe(0);
  });
});

describe('locked connectors (053 US4)', () => {
  const linked = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b', locked: true },
      { id: 'e2', from: 'a', to: 'b' },
      { id: 'e3', from: 'b', to: 'a' },
    ],
    stickies: [
      { id: 's1', text: 'x', position: { x: 0, y: 300 }, locked: true },
      { id: 's2', text: 'y', position: { x: 100, y: 300 } },
    ],
  });
  const lockAction = (ids: string[], file = linked) => {
    const ctx = actionContext({ kind: 'connections', ids: sel({ edges: ids }) }, 'edit', file);
    const action = actionsFor(ACTIONS, ctx, 'toolbar')
      .flatMap((s) => s.actions)
      .find((a) => a.id === 'connection.lock');
    return { ctx, action };
  };

  it('has helpers for connectors and notes', () => {
    expect(isEdgeLocked(linked, 'e1')).toBe(true);
    expect(isEdgeLocked(linked, 'e2')).toBe(false);
    expect(isEdgeLocked(linked, 'missing')).toBe(false);
    expect(isStickyLocked(linked, 's1')).toBe(true);
    expect(unlockedIds(linked, 'edges', ['e1', 'e2'])).toEqual({ ids: ['e2'], skipped: 1 });
    expect(unlockedIds(linked, 'stickies', ['s1', 's2'])).toEqual({ ids: ['s2'], skipped: 1 });
    expect(
      withoutLocked(linked, [
        { scope: 'edges', id: 'e1' },
        { scope: 'edges', id: 'e2' },
        { scope: 'stickies', id: 's1' },
        { scope: 'stickies', id: 's2' },
        { scope: 'groups', id: 'g' },
      ]),
    ).toEqual({
      targets: [
        { scope: 'edges', id: 'e2' },
        { scope: 'stickies', id: 's2' },
        { scope: 'groups', id: 'g' },
      ],
      skipped: 2,
    });
  });

  it('locks several connectors in one undo step, then unlocks them in one', () => {
    const { ctx, action } = lockAction(['e2', 'e3']);
    expect(action?.label).toBe('Lock');
    action?.run();
    expect(toJSON(ctx.doc).edges.map((e) => e.locked)).toEqual([true, true, true]);
    expect(ui().announcement.text).toBe('Locked 2 connectors');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).edges.map((e) => e.locked)).toEqual([true, undefined, undefined]);
    ctx.editor.redo();
    const again = lockAction(['e1', 'e2', 'e3'], toJSON(ctx.doc));
    expect(again.action?.label).toBe('Unlock');
    expect(again.action?.checked).toBe(true);
    again.action?.run();
    expect(toJSON(again.ctx.doc).edges.some((e) => e.locked !== undefined)).toBe(false);
    again.ctx.editor.undo();
    expect(toJSON(again.ctx.doc).edges.every((e) => e.locked === true)).toBe(true);
  });

  it('locks the rest when only some are locked', () => {
    const { ctx, action } = lockAction(['e1', 'e2']);
    expect(action?.label).toBe('Lock');
    action?.run();
    expect(toJSON(ctx.doc).edges.map((e) => e.locked)).toEqual([true, true, undefined]);
  });

  it('is on the context menu of one connector too', () => {
    const ctx = actionContext({ kind: 'connection', ids: sel({ edges: ['e1'] }) }, 'edit', linked);
    const lock = actionsFor(ACTIONS, ctx, 'menu')
      .flatMap((s) => s.actions)
      .find((a) => a.id === 'connection.lock');
    expect(lock?.label).toBe('Unlock');
  });

  it('refuses reshape, reconnect, style and delete in the model, and edits again once unlocked', () => {
    const { doc, editor } = actionContext(
      { kind: 'connection', ids: sel({ edges: ['e1'] }) },
      'edit',
      linked,
    );
    const codeOf = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        return (error as { code?: string }).code;
      }
      return undefined;
    };
    expect(
      codeOf(() => {
        editor.setEdgeRoute('e1', { fromSide: 'left' });
      }),
    ).toBe('locked');
    expect(
      codeOf(() => {
        editor.update('edges', 'e1', { to: 'a' });
      }),
    ).toBe('locked');
    expect(
      codeOf(() => {
        editor.setEdgeStyle(['e1'], { width: 4 });
      }),
    ).toBe('locked');
    expect(
      codeOf(() => {
        editor.remove('edges', 'e1');
      }),
    ).toBe('locked');
    editor.setLocked(['e1'], false, 'edges');
    editor.setEdgeStyle(['e1'], { width: 4 });
    expect(toJSON(doc).edges[0]?.style?.width).toBe(4);
  });

  it('deletes only the unlocked connectors of a selection, saying how many were skipped', async () => {
    const { user, doc } = setup(linked);
    act(() => {
      ui().select({ edges: ['e1', 'e2'] });
    });
    await user.keyboard('{Delete}');
    expect(toJSON(doc).edges.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(ui().announcement.text).toMatch(/· Skipped 1 locked$/);
  });

  it('never deletes a locked connector alone', async () => {
    const { user, doc } = setup(linked);
    act(() => {
      ui().select({ edges: ['e1'] });
    });
    await user.keyboard('{Delete}');
    expect(toJSON(doc).edges).toHaveLength(3);
    expect(ui().announcement.text).toBe('Skipped 1 locked · unlock to delete');
  });
});
