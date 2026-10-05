import { toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as Router from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CORPUS } from '../../db/fixtures/import/corpus';
import { createInlineImportClient } from '../../db/import/import-client';
import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { ImportDialog } from './import-dialog';
import { setImportClientForTests } from './import-session';

vi.mock('../../layout/layout-client', async () => {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const { computeLayout } = await import('../../layout/elk-layout');
  const elk = new ELK();
  return {
    LayoutCancelled: class extends Error {},
    createLayoutClient: () => ({
      layout: (request: Parameters<typeof computeLayout>[0]) => computeLayout(request, elk),
      cancel: () => undefined,
      terminate: () => undefined,
    }),
  };
});

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  useNavigate: () => navigate,
}));

function Harness() {
  const open = useUiStore((s) => s.importDialog.open);
  return open ? <ImportDialog /> : null;
}

function setup(
  file: SododeckFile = deckOf({ name: 'Deck' }),
  ui: Partial<ReturnType<typeof useUiStore.getState>> = {},
) {
  const { wrapper, editor } = editorWrapper(file);
  useUiStore.setState(ui);
  const user = userEvent.setup();
  render(<Harness />, { wrapper });
  act(() => {
    useUiStore.getState().openImport(null);
  });
  return { user, editor };
}

const dialog = () => screen.getByRole('dialog', { name: 'Import SQL or DBML' });
const status = () => within(dialog()).getByRole('status');
const importButton = () => within(dialog()).getByRole('button', { name: /^Import|Importing/ });

function paste(text: string) {
  fireEvent.change(screen.getByLabelText('SQL or DBML text'), { target: { value: text } });
}

beforeEach(() => {
  setImportClientForTests(createInlineImportClient());
  navigate.mockReset();
});
afterEach(() => {
  setImportClientForTests(null);
});

describe('ImportDialog (044 T022)', () => {
  it('starts empty with Import disabled', () => {
    setup();
    expect(status()).toHaveTextContent('Paste SQL or DBML, or drop a file');
    expect(importButton()).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Import into this deck' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Detect foreign keys by name/ })).toBeChecked();
  });

  it('previews the counts of pasted SQL and names the detected dialect', async () => {
    setup();
    paste(CORPUS['pg-30-tables.sql']);
    await waitFor(() => {
      expect(status()).toHaveTextContent(
        '30 tables, 35 relationships, 2 enums · 17 statements will be skipped',
      );
    });
    expect(importButton()).toHaveAccessibleName('Import 30 tables');
    expect(within(dialog()).getByRole('combobox', { name: 'Dialect' })).toHaveTextContent(
      'Auto · Postgres detected',
    );
  });

  it('shows a syntax error with its line and keeps Import disabled', async () => {
    setup();
    paste(CORPUS['syntax-error.sql']);
    await waitFor(() => {
      expect(status()).toHaveTextContent(/^Line 12: /);
    });
    expect(importButton()).toBeDisabled();
  });

  it('refuses a file of another type or over 5 MB before reading it', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: 'File' }));
    const input = screen.getByTestId('import-file-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'deck.json')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a .sql, .dbml or .txt file.',
    );
    const big = new File(['x'], 'big.sql');
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is larger than 5 MB.');
  });

  it('closes on Cancel and writes nothing (FR-006)', async () => {
    const { user, editor } = setup();
    const before = toJSON(editor().doc);
    paste(CORPUS['sqlite.sql']);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useUiStore.getState().importDialog.open).toBe(false);
    expect(toJSON(editor().doc)).toEqual(before);
  });

  it('imports into the deck as one undo step, then shows the toast and the report', async () => {
    const { user, editor } = setup();
    paste(CORPUS['mysql-dump.sql']);
    await waitFor(() => {
      expect(importButton()).toBeEnabled();
    });
    await user.click(importButton());
    await waitFor(() => {
      expect(useUiStore.getState().importDialog.open).toBe(false);
    });
    const file = toJSON(editor().doc);
    expect(file.nodes.map((n) => n.title)).toEqual(['customers', 'orders', 'order_items']);
    expect(file.dialect).toBe('mysql');
    expect(
      await screen.findByText('Imported 3 tables, 2 relationships, 2 enums'),
    ).toBeInTheDocument();
    expect(useUiStore.getState().flyout).toBe('import-report');
    expect(useUiStore.getState().importReport?.mapped.tables).toBe(3);
    act(() => {
      editor().undo();
    });
    expect(toJSON(editor().doc).nodes).toEqual([]);
  });
});

describe('ImportDialog targets (044 T033)', () => {
  const withCard = deckOf({
    name: 'Deck',
    nodes: [{ id: 'card.db', type: 'database', title: 'Orders DB', position: { x: 0, y: 0 } }],
  });

  it('offers the database card in context first and imports inside it', async () => {
    const { user, editor } = setup(withCard, {
      selection: { nodes: ['card.db'], edges: [], groups: [], stickies: [], images: [] },
    });
    expect(screen.getByRole('radio', { name: 'Import into Orders DB' })).toBeChecked();
    paste(CORPUS['sqlite.sql']);
    await waitFor(() => {
      expect(importButton()).toBeEnabled();
    });
    await user.click(importButton());
    await waitFor(() => {
      expect(useUiStore.getState().importDialog.open).toBe(false);
    });
    const tables = toJSON(editor().doc).nodes.filter((n) => n.type === 'db-table');
    expect(tables).toHaveLength(3);
    expect(tables.every((t) => t.parent === 'card.db')).toBe(true);
  });

  it('offers "Import into this deck" without a card in context, and New deck', () => {
    setup(withCard);
    expect(screen.getByRole('radio', { name: 'Import into this deck' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'New deck' })).not.toBeChecked();
  });
});

describe('ImportDialog dialect notice (044 T036)', () => {
  it('lists conversions when the deck has another dialect', async () => {
    setup(deckOf({ name: 'Deck', dialect: 'postgres' }));
    paste(CORPUS['mysql-dump.sql']);
    await waitFor(() => {
      expect(
        within(dialog()).getByText(/^This deck is Postgres: \d+ column types will be converted$/),
      ).toBeInTheDocument();
    });
    expect(within(dialog()).getByText(/datetime → timestamp/)).toHaveTextContent(
      /A new deck keeps MySQL\.$/,
    );
  });

  it('says types are kept on a Generic deck that has tables', async () => {
    setup(
      deckOf({
        name: 'Deck',
        nodes: [{ id: 't', type: 'db-table', title: 'existing', columns: [] }],
      }),
    );
    paste(CORPUS['mysql-dump.sql']);
    expect(
      await within(dialog()).findByText('This deck is Generic: types are kept as written.'),
    ).toBeInTheDocument();
  });
});
