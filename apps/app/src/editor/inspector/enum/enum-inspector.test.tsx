import { toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { shopDeck } from '../../../db/fixtures/shop';
import { useDeckSnapshot } from '../../../model/use-deck-snapshot';
import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { renderWithEditor } from '../../../test/render-canvas';
import { EnumInspector } from './enum-inspector';

const STATUS = 'enum.order_status';

/** Shop plus a second enum in another schema, with `orders.status` linked to order_status. */
function deckWithUsers(): SododeckFile {
  const deck = shopDeck('postgres');
  return {
    ...deck,
    enums: [
      ...(deck.enums ?? []),
      { id: 'enum.kind', name: 'kind', schema: 'other', values: [] },
      { id: 'enum.kind2', name: 'order_status', schema: 'other', values: [] },
    ],
  };
}

function render(deck = deckWithUsers(), enumId = STATUS) {
  function Harness() {
    const snapshot = useDeckSnapshot(useEditor().doc);
    return <EnumInspector deck={snapshot} enumId={enumId} />;
  }
  const view = renderWithEditor(<Harness />, deck);
  const dbEnum = () => toJSON(view.doc).enums?.find((e) => e.id === enumId);
  return { ...view, user: userEvent.setup(), dbEnum };
}

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

describe('EnumInspector (052 US4)', () => {
  it('shows "Enum · n values" and the enum name in the header', () => {
    render();
    expect(screen.getByText('Enum · 4 values')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'order_status' })).toBeInTheDocument();
  });

  it('renames through renameEnum: linked columns follow, one undo restores both', async () => {
    const view = render();
    const linked = () =>
      toJSON(view.doc)
        .nodes.flatMap((n) => n.columns ?? [])
        .filter((c) => c.enumRef === STATUS)
        .map((c) => c.type);
    expect(linked().length).toBeGreaterThan(0);
    const name = screen.getByRole('textbox', { name: 'Name' });
    await view.user.clear(name);
    await view.user.type(name, 'state{Enter}');
    expect(view.dbEnum()?.name).toBe('state');
    expect(new Set(linked())).toEqual(new Set(['state']));
    // One focus session is one undo step, for the enum and its columns together.
    act(() => {
      view.editor().undo();
    });
    expect(view.dbEnum()?.name).toBe('order_status');
    expect(new Set(linked())).toEqual(new Set(['order_status']));
  });

  it('refuses a name another enum of the schema already has', async () => {
    const deck = deckWithUsers();
    const view = render({
      ...deck,
      enums: [...(deck.enums ?? []), { id: 'enum.dup', name: 'kind', values: [] }],
    });
    const name = screen.getByRole('textbox', { name: 'Name' });
    await view.user.clear(name);
    await view.user.type(name, 'KIND');
    expect(
      screen.getByText('An enum named KIND already exists in the default schema'),
    ).toBeVisible();
    expect(view.dbEnum()?.name).not.toBe('KIND');
    await view.user.tab();
    expect(view.dbEnum()?.name).toBe('order_status');
  });

  it('allows the same name in another schema', async () => {
    const view = render();
    const schema = screen.getByRole('textbox', { name: 'Schema' });
    await view.user.type(schema, 'other');
    // order_status also exists in "other": the schema write is refused. Earlier keystrokes ("o",
    // "ot"…) are valid and may have been saved while typing, so only the final text is checked.
    expect(screen.getByText('An enum named order_status already exists in other')).toBeVisible();
    expect(view.dbEnum()?.schema).not.toBe('other');
  });

  it('writes the note and the colour', async () => {
    const view = render();
    const note = screen.getByRole('textbox', { name: 'Note' });
    await view.user.clear(note);
    await view.user.type(note, 'hi');
    await view.user.tab();
    expect(view.dbEnum()?.note).toBe('hi');
    await view.user.click(screen.getByRole('radio', { name: /Blue/i }));
    expect(view.dbEnum()?.color).toBe('blue');
  });

  it('adds a value as value_n with its name focused', async () => {
    const view = render();
    await view.user.click(screen.getByRole('button', { name: 'Add value' }));
    const values = view.dbEnum()?.values.map((v) => v.name);
    expect(values).toEqual(['pending', 'paid', 'shipped', 'cancelled', 'value_1']);
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Value name value_1' })).toHaveFocus();
    });
  });

  it('renames a value (defaults follow) and refuses a duplicate', async () => {
    const view = render();
    const first = screen.getByRole('textbox', { name: 'Value name pending' });
    await view.user.clear(first);
    await view.user.type(first, 'PAID');
    expect(screen.getByText('PAID is already a value of order_status')).toBeVisible();
    expect(view.dbEnum()?.values.map((v) => v.name)).not.toContain('PAID');
    await view.user.clear(first);
    await view.user.type(first, 'queued{Enter}');
    expect(view.dbEnum()?.values[0]?.name).toBe('queued');
    const status = toJSON(view.doc)
      .nodes.flatMap((n) => n.columns ?? [])
      .find((c) => c.id === 'orders.status');
    expect(status?.default).toBe('queued');
  });

  it('writes a value note', async () => {
    const view = render();
    const note = screen.getByRole('textbox', { name: 'Value note pending' });
    await view.user.type(note, 'waiting{Enter}');
    expect(view.dbEnum()?.values[0]?.note).toBe('waiting');
  });

  it('moves a value with ⌥↓ and deletes it from its menu', async () => {
    const view = render();
    const row = screen.getByRole('textbox', { name: 'Value name pending' });
    await view.user.click(row);
    await view.user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(view.dbEnum()?.values.map((v) => v.name)).toEqual([
      'paid',
      'pending',
      'shipped',
      'cancelled',
    ]);
    await view.user.click(screen.getByRole('button', { name: 'Value options pending' }));
    await view.user.click(await screen.findByRole('menuitem', { name: 'Delete value' }));
    expect(view.dbEnum()?.values.map((v) => v.name)).toEqual(['paid', 'shipped', 'cancelled']);
  });

  it('lists the columns that use it and opens the table drawer on one', async () => {
    const view = render();
    const used = screen.getByRole('list', { name: 'Used by' });
    const chip = within(used).getByRole('button', { name: 'orders.status' });
    await view.user.click(chip);
    const ui = useUiStore.getState();
    expect(ui.tableDrawer.tab).toBe('columns');
    expect(ui.tableDrawer.expandedColumnId).not.toBeNull();
    expect(ui.drawer.mode).toBe('selection');
  });

  it('confirms before deleting an enum in use, then unlinks the columns and keeps their type', async () => {
    const view = render();
    await view.user.click(screen.getByRole('button', { name: 'Enum options' }));
    await view.user.click(await screen.findByRole('menuitem', { name: 'Delete enum' }));
    expect(
      screen.getByText(
        'Delete order_status? 1 column uses it and keeps order_status as plain type text.',
      ),
    ).toBeVisible();
    await view.user.click(screen.getByRole('button', { name: 'Delete enum' }));
    expect(view.dbEnum()).toBeUndefined();
    const status = toJSON(view.doc)
      .nodes.flatMap((n) => n.columns ?? [])
      .find((c) => c.id === 'orders.status');
    expect(status?.enumRef).toBeUndefined();
    expect(status?.type).toBe('order_status');
    expect(await screen.findByText('Deleted enum order_status')).toBeVisible();
  });

  it('deletes an unused enum with only the toast', async () => {
    const view = render(deckWithUsers(), 'enum.kind');
    await view.user.click(screen.getByRole('button', { name: 'Enum options' }));
    await view.user.click(await screen.findByRole('menuitem', { name: 'Delete enum' }));
    expect(view.dbEnum()).toBeUndefined();
    expect(await screen.findByText('Deleted enum kind')).toBeVisible();
  });
});
