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
import { LOCKED_HINT, unlockedOf, withoutLocked } from './lock';
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
