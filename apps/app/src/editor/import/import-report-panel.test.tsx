import { toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ImportReport } from '../../db/import/types';
import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { ImportReportPanel } from './import-report-panel';

const deck = deckOf({
  name: 'Deck',
  nodes: [
    {
      id: 'customers',
      type: 'db-table',
      title: 'customers',
      columns: [{ id: 'c.id', name: 'id', type: 'int', pk: true }],
    },
    {
      id: 'orders',
      type: 'db-table',
      title: 'orders',
      columns: [{ id: 'o.cid', name: 'customer_id', type: 'int' }],
    },
    {
      id: 'lines',
      type: 'db-table',
      title: 'lines',
      columns: [{ id: 'l.cid', name: 'customer_id', type: 'int' }],
    },
  ],
});

const suggestion = (from: string, column: string) => ({
  fromTable: from,
  fromColumn: column,
  toTable: 'customers',
  toColumn: 'c.id',
  label: `${from}.customer_id → customers.id`,
  cardinality: 'n-1' as const,
  fromOptional: true,
  state: 'open' as const,
});

function report(patch: Partial<ImportReport> = {}): ImportReport & { deckId: string | null } {
  return {
    deckId: null,
    source: { format: 'sql', dialect: 'mysql' },
    mapped: {
      tables: 3,
      relationships: 0,
      enums: 1,
      indexes: 2,
      checks: 0,
      groups: 0,
      stickies: 0,
    },
    skipped: [{ line: 88, excerpt: 'CREATE VIEW order_totals AS', reason: 'view' }],
    changed: [
      {
        line: 12,
        target: 'orders',
        kind: 'option-dropped',
        detail: 'table options not stored: ENGINE',
      },
    ],
    suggestions: [suggestion('orders', 'o.cid'), suggestion('lines', 'l.cid')],
    ...patch,
  };
}

function Panel() {
  const editor = useEditor();
  return <ImportReportPanel deck={useDeckSnapshot(editor.doc)} />;
}

function setup(file: SododeckFile = deck, value: ReturnType<typeof report> | null = report()) {
  const { wrapper, editor } = editorWrapper(file);
  act(() => {
    useUiStore.getState().setImportReport(value);
  });
  const user = userEvent.setup();
  render(<Panel />, { wrapper });
  return { user, editor };
}

describe('ImportReportPanel (044 T025)', () => {
  it('lists mapped counts, and skipped and changed rows under their fidelity group (062)', () => {
    setup();
    expect(
      within(screen.getByRole('list', { name: 'Mapped' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['3 tables', '0 relationships', '1 enum', '2 indexes']);
    const group = screen.getByRole('region', { name: 'Left out (2)' });
    const rows = within(within(group).getByRole('list', { name: 'Left out' })).getAllByRole(
      'listitem',
    );
    expect(rows[0]).toHaveTextContent('L88CREATE VIEW order_totals ASviews are not modelled');
    expect(rows[1]).toHaveTextContent('L12table options not stored: ENGINE');
  });

  it('says everything was imported when nothing was skipped or changed (062 FR-015)', () => {
    setup(deck, report({ skipped: [], changed: [] }));
    expect(screen.getByText('Everything was imported.')).toBeInTheDocument();
  });

  it('copies the report as JSON (062 FR-016)', async () => {
    const { user } = setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await user.click(screen.getByRole('button', { name: 'Copy report' }));
    const copied = JSON.parse(String(writeText.mock.calls[0]?.[0])) as {
      report: string;
      source: unknown;
      items: { code: string; group: string }[];
    };
    expect(copied.report).toBe('sododeck-import');
    expect(copied.source).toEqual({ format: 'sql', dialect: 'mysql' });
    expect(copied.items.map((i) => [i.code, i.group])).toEqual([
      ['import-db-option-dropped', 'left-out'],
      ['import-db-view', 'left-out'],
    ]);
  });

  it('collapses long runs of one reason', () => {
    const skipped = Array.from({ length: 25 }, (_, i) => ({
      line: i + 1,
      excerpt: 'INSERT INTO t',
      reason: 'data' as const,
    }));
    setup(deck, report({ skipped }));
    expect(screen.getByText('and 5 more data statements')).toBeInTheDocument();
  });

  it('says so when there is no report, and the report is dropped when another deck opens', () => {
    setup(deck, null);
    expect(screen.getByText('No import in this deck yet.')).toBeInTheDocument();
    act(() => {
      useUiStore.getState().setImportReport(report({}));
      useUiStore.getState().resetForDeck('another');
    });
    expect(useUiStore.getState().importReport).toBeNull();
  });
});

describe('ImportReportPanel suggestions (044 T039)', () => {
  it('Accept adds one relationship as one undo step; Undo reopens the suggestion', async () => {
    const { user, editor } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Accept orders.customer_id → customers.id' }),
    );
    expect(toJSON(editor().doc).edges).toEqual([
      expect.objectContaining({
        from: 'orders',
        to: 'customers',
        fromColumns: ['o.cid'],
        toColumns: ['c.id'],
        cardinality: 'n-1',
        fromOptional: true,
      }),
    ]);
    expect(screen.getByText('Added')).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(editor().doc).edges).toEqual([]);
    expect(
      screen.getByRole('button', { name: 'Accept orders.customer_id → customers.id' }),
    ).toBeInTheDocument();
  });

  it('Dismiss removes the row; Accept all writes every open one in one step', async () => {
    const { user, editor } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Dismiss orders.customer_id → customers.id' }),
    );
    expect(screen.queryByText('orders.customer_id → customers.id')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(toJSON(editor().doc).edges).toHaveLength(1);
    act(() => {
      editor().undo();
    });
    expect(toJSON(editor().doc).edges).toHaveLength(0);
  });

  it('focus on a row highlights its column row', async () => {
    const { user } = setup();
    await user.tab(); // Copy report (062)
    expect(screen.getByRole('button', { name: 'Copy report' })).toHaveFocus();
    await user.tab();
    expect(useUiStore.getState().hoverFocus).toEqual({
      id: 'orders',
      source: 'column',
      column: { tableId: 'orders', columnId: 'o.cid' },
    });
  });

  it('has no section when the option was off', () => {
    setup(deck, report({ suggestions: null }));
    expect(screen.queryByText(/Foreign keys by name/)).not.toBeInTheDocument();
  });
});
