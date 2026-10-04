import { toJSON } from '@sododeck/model';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { shopDeck } from '../../../db/fixtures/shop';
import { useDeckSnapshot } from '../../../model/use-deck-snapshot';
import { useEditor } from '../../../model/use-editor';
import { editorWrapper } from '../../../test/render-canvas';
import { DatabaseSection } from './database-section';

function Harness() {
  const deck = useDeckSnapshot(useEditor().doc);
  return <DatabaseSection deck={deck} />;
}

function setup(file = shopDeck('postgres')) {
  const { wrapper, doc, editor } = editorWrapper(file);
  render(<Harness />, { wrapper });
  return { doc, editor, user: userEvent.setup() };
}

async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('combobox', { name: 'Dialect' }));
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${name}`) }));
}

describe('DatabaseSection (052 US3)', () => {
  it('shows the dialect select with a hint per option and the existing switches', async () => {
    const { user } = setup();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(
      screen.getByText('One dialect for every table and database card in this deck.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Dialect' })).toHaveTextContent('Postgres');
    expect(screen.getByRole('list', { name: 'Show on tables' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Cardinality ends' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Dialect' }));
    expect(
      (await screen.findAllByText('uuid, jsonb, timestamptz, enums, arrays')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Type affinity: integer, text, real, blob')).toBeInTheDocument();
    expect(screen.getByText('char(36) ids, json, datetime, ENUM per column')).toBeInTheDocument();
    expect(
      screen.getByText('Common types only; SQL export asks which dialect'),
    ).toBeInTheDocument();
  });

  it('opens a confirm with the first five rows, a "+ n more" line and the kept list', async () => {
    const { doc, editor, user } = setup();
    act(() => {
      editor().addColumn('customers', { id: 'c.search', name: 'search', type: 'tsvector' });
    });
    await pick(user, 'MySQL');
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(/^Convert \d+ columns from Postgres to MySQL\?$/),
    ).toBeVisible();
    expect(within(dialog).getAllByRole('row')).toHaveLength(5);
    expect(within(dialog).getByText(/^\+ \d+ more/)).toBeVisible();
    expect(within(dialog).getByText('Kept as written')).toBeVisible();
    expect(toJSON(doc).dialect).toBe('postgres');
  });

  it('Cancel changes nothing', async () => {
    const { doc, user } = setup();
    await pick(user, 'MySQL');
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toJSON(doc).dialect).toBe('postgres');
  });

  it('Confirm applies the change, shows the toast and one undo restores it', async () => {
    const { doc, editor, user } = setup();
    const before = toJSON(doc);
    await pick(user, 'MySQL');
    await user.click(await screen.findByRole('button', { name: /^Convert \d+ columns$/ }));
    expect(toJSON(doc).dialect).toBe('mysql');
    expect(await screen.findByText(/^Converted \d+ columns to MySQL/)).toBeVisible();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(before);
  });

  it('applies at once, with a toast, when nothing converts', async () => {
    const { doc, user } = setup({ ...shopDeck('postgres'), nodes: [], edges: [], enums: [] });
    await pick(user, 'SQLite');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toJSON(doc).dialect).toBe('sqlite');
    expect(await screen.findByText('Dialect set to SQLite')).toBeVisible();
  });
});
