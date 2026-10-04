import { toJSON } from '@sododeck/model';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useRef } from 'react';

import { schemaExport } from '../../db/export/schema-export';
import { DEFAULT_SQL_OPTIONS } from '../../db/export/types';
import { shopDeck } from '../../db/fixtures/shop';
import { edits, shopText } from '../../db/fixtures/sync/shop-edits';
import type { TextProblem } from '../../db/sync/types';
import { useUiStore } from '../../state/ui-store';
import { editorWrapper } from '../../test/render-canvas';
import { DbmlTab } from './dbml-tab';

// Monaco does not run in jsdom: a double with a textarea for the model, the problems as a list,
// and a button for the deck-undo key.
vi.mock('./dbml-editor', () => ({
  default: function DbmlEditorDouble(props: {
    initialText: string;
    ariaLabel: string;
    problems: readonly TextProblem[];
    onReady: (handle: { getText: () => string; setText: (text: string) => void }) => void;
    onUserChange: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onUndo: () => void;
  }) {
    const area = useRef<HTMLTextAreaElement>(null);
    const { onReady } = props;
    useEffect(() => {
      onReady({
        getText: () => area.current?.value ?? '',
        setText: (text) => {
          if (area.current) area.current.value = text;
        },
      });
    }, [onReady]);
    return (
      <div>
        <textarea
          ref={area}
          aria-label={props.ariaLabel}
          defaultValue={props.initialText}
          onInput={props.onUserChange}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
        />
        <ul aria-label="Markers">
          {props.problems.map((p, i) => (
            <li key={i}>{`${p.severity}:${String(p.line)}:${p.message}`}</li>
          ))}
        </ul>
        <button type="button" onClick={props.onUndo}>
          Deck undo
        </button>
      </div>
    );
  },
}));

const deck = shopDeck('postgres');

function setup(scope: 'schema' | 'selection' = 'schema', selection: string[] = []) {
  const { wrapper, doc, editor } = editorWrapper(deck);
  if (selection.length > 0) useUiStore.getState().select({ nodes: selection });
  render(<DbmlTab scope={scope} />, { wrapper });
  const area = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'DBML schema' });
  const type = (text: string) => {
    fireEvent.focus(area());
    area().value = text;
    fireEvent.input(area());
  };
  const pause = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
  };
  const tables = () =>
    toJSON(doc)
      .nodes.filter((n) => n.type === 'db-table')
      .map((n) => n.title);
  return { doc, editor, area, type, pause, tables };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

const nodeNamed = (d: ReturnType<typeof setup>['doc'], name: string) =>
  toJSON(d).nodes.find((n) => n.title === name);

describe('DbmlTab (Whole schema)', () => {
  it('shows the writer’s DBML, labelled, with an Applied pill and the helper text', async () => {
    const { area } = setup();
    await waitFor(() => {
      expect(area().value).toBe(shopText());
    });
    expect(screen.getByRole('region', { name: 'DBML schema' })).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('Edits apply as you type')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('typing a column, then a pause, adds it to the deck and says Applying… then Applied', async () => {
    const { doc, area, type, pause } = setup();
    await waitFor(() => {
      expect(area().value).not.toBe('');
    });
    type(edits.addColumn(shopText()));
    expect(screen.getByText('Applying…')).toBeInTheDocument();
    await pause();
    await waitFor(() => {
      expect(screen.getByText('Applied')).toBeInTheDocument();
    });
    const orders = nodeNamed(doc, 'orders');
    expect(orders?.columns?.find((c) => c.name === 'discount_cents')).toMatchObject({
      type: 'integer',
      notNull: true,
    });
  });

  it('renaming a table keeps its id', async () => {
    const { doc, area, type, pause } = setup();
    await waitFor(() => {
      expect(area().value).not.toBe('');
    });
    const id = nodeNamed(doc, 'customers')?.id;
    type(edits.renameTable(shopText()));
    await pause();
    await waitFor(() => {
      expect(nodeNamed(doc, 'clients')?.id).toBe(id);
    });
  });

  it('shows an error with a suggestion, keeps the canvas, and applies once fixed', async () => {
    const { doc, area, type, pause } = setup();
    await waitFor(() => {
      expect(area().value).not.toBe('');
    });
    const before = toJSON(doc);
    type(edits.typo(shopText()));
    await pause();
    expect(await screen.findByText("Can't apply: fix 1 error")).toBeInTheDocument();
    expect(screen.getByText('Canvas keeps the last valid schema')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Markers' }).textContent).toMatch(
      /error:\d+:.*did you mean not null/i,
    );
    expect(toJSON(doc)).toEqual(before);
    type(edits.addColumn(shopText()));
    await pause();
    await waitFor(() => {
      expect(screen.getByText('Applied')).toBeInTheDocument();
    });
    expect(nodeNamed(doc, 'orders')?.columns?.some((c) => c.name === 'discount_cents')).toBe(true);
  });

  it('one deck undo takes back everything typed in a burst', async () => {
    const { doc, area, type, pause, editor } = setup();
    await waitFor(() => {
      expect(area().value).not.toBe('');
    });
    const before = toJSON(doc);
    type(edits.addColumn(shopText()));
    await pause();
    await waitFor(() => {
      expect(nodeNamed(doc, 'orders')?.columns?.some((c) => c.name === 'discount_cents')).toBe(
        true,
      );
    });
    type(edits.renameTable(edits.addColumn(shopText())));
    await pause();
    await waitFor(() => {
      expect(nodeNamed(doc, 'clients')).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Deck undo' }));
    expect(toJSON(doc)).toEqual(before);
    expect(editor().canUndo()).toBe(false);
  });

  it('deleting a table block removes the table and shows "Removed shipments" with Undo', async () => {
    const { doc, area, type, pause } = setup();
    await waitFor(() => {
      expect(area().value).not.toBe('');
    });
    type(edits.removeTable(shopText()));
    await pause();
    await waitFor(() => {
      expect(nodeNamed(doc, 'shipments')).toBeUndefined();
    });
    expect(await screen.findByText('Removed shipments')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(nodeNamed(doc, 'shipments')).toBeDefined();
  });

  it('cutting a block and pasting it back restores the same table', async () => {
    const { doc, area, type, pause } = setup();
    await waitFor(() => {
      expect(area().value).not.toBe('');
    });
    const id = nodeNamed(doc, 'shipments')?.id;
    type(edits.removeTable(shopText()));
    await pause();
    await waitFor(() => {
      expect(nodeNamed(doc, 'shipments')).toBeUndefined();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    type(shopText());
    await pause();
    await waitFor(() => {
      expect(nodeNamed(doc, 'shipments')?.id).toBe(id);
    });
  });

  it('asks before removing every table: nothing is removed until Apply', async () => {
    const { doc, area, type, pause, tables } = setup();
    await waitFor(() => {
      expect(area().value).not.toBe('');
    });
    const count = tables().length;
    type('');
    await pause();
    expect(await screen.findByText(`This removes all ${String(count)} tables`)).toBeInTheDocument();
    expect(tables()).toHaveLength(count);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(toJSON(doc).nodes.filter((n) => n.type === 'db-table')).toHaveLength(0);
  });

  it('a TableGroup block is a warning and the rest still applies', async () => {
    const { area, type, pause } = setup();
    await waitFor(() => {
      expect(area().value).not.toBe('');
    });
    type(edits.tableGroup(edits.addColumn(shopText())));
    await pause();
    expect(await screen.findByText('1 warning')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Markers' }).textContent).toMatch(/warning:/);
  });

  it('discards unapplied text when the editor loses focus', async () => {
    const { area, type, pause } = setup();
    await waitFor(() => {
      expect(area().value).not.toBe('');
    });
    type(edits.typo(shopText()));
    await pause();
    await screen.findByText("Can't apply: fix 1 error");
    fireEvent.blur(area());
    await waitFor(() => {
      expect(area().value).toBe(shopText());
    });
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('hints at what to type in an empty deck', async () => {
    const { wrapper } = editorWrapper({ ...deck, nodes: [], edges: [], enums: [] });
    render(<DbmlTab scope="schema" />, { wrapper });
    expect(await screen.findByText('Type a table to start your schema.')).toBeInTheDocument();
  });
});

describe('DbmlTab (Selection)', () => {
  const ids = ['orders', 'order_items'];

  it('holds only the selected tables and hints when nothing is selected', async () => {
    const { area } = setup('selection', ids);
    await waitFor(() => {
      expect(area().value).toContain('Table orders {');
    });
    expect(area().value).toContain('Table order_items {');
    expect(area().value).not.toContain('Table customers {');
    expect(area().value).toBe(
      schemaExport(deck, {
        format: 'dbml',
        scope: { kind: 'selection', tableIds: ids },
        dialect: null,
        sql: DEFAULT_SQL_OPTIONS,
      }).text,
    );
  });

  it('shows the empty-selection hint', async () => {
    setup('selection', []);
    expect(
      await screen.findByText(
        'Select tables, or switch to Whole schema. You can also type a new table here.',
      ),
    ).toBeInTheDocument();
  });

  it('deleting a block removes only that table', async () => {
    const { doc, area, type, pause } = setup('selection', ids);
    await waitFor(() => {
      expect(area().value).toContain('Table orders {');
    });
    const text = area()
      .value.replace(/Table order_items \{[\s\S]*?\n\}\n\n?/, '')
      .replace(/Ref: order_items[^\n]*\n/g, '');
    type(text);
    await pause();
    await waitFor(() => {
      expect(nodeNamed(doc, 'order_items')).toBeUndefined();
    });
    expect(nodeNamed(doc, 'orders')).toBeDefined();
    expect(nodeNamed(doc, 'customers')).toBeDefined();
    expect(nodeNamed(doc, 'shipments')).toBeDefined();
  });
});
