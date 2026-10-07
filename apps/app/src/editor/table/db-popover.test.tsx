import type { DeckDoc } from '@sododeck/model';
import type { DbColumn } from '@sododeck/schema';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { fixedWidthMeasurer } from '../export/text-measure';
import { tableContextOf } from '../table-keys';
import { tableLayout } from '../table-layout';
import { cancelDbHover, DB_REST_MS, pointerOver } from './db-hover';
import { DbPopover } from './db-popover';
import { EnumPopover } from './enum-popover';
import { TableBody } from './table-body';

const columns: DbColumn[] = [
  { id: 'id', name: 'id', type: 'int', pk: true, note: 'Unique user ID' },
  {
    id: 'email',
    name: 'email',
    type: 'varchar',
    size: '320',
    notNull: true,
    note: 'Used for sign-in\nnever shown <b>publicly</b>',
  },
  { id: 'name', name: 'name', type: 'text' },
  { id: 'created', name: 'created_at', type: 'timestamptz', default: 'now()' },
  { id: 'role', name: 'role', type: 'user_role', enumRef: 'e-role', note: 'Access level' },
];

const file = deckOf({
  enums: [{ id: 'e-role', name: 'user_role', values: [{ id: 'v1', name: 'admin' }] }],
  nodes: [
    {
      id: 'users',
      type: 'db-table',
      title: 'users',
      description: 'Stores registered users',
      columns,
    },
    { id: 'audit', type: 'db-table', title: 'audit', columns: [] },
  ],
});

/** The cards as the canvas draws them: a title row, the rows, the popovers, from the live deck. */
function Cards({ doc }: { doc: DeckDoc }) {
  const deck = useDeckSnapshot(doc);
  return (
    <>
      {deck.nodes.map((node) => {
        const layout = tableLayout(node, tableContextOf(deck), undefined, fixedWidthMeasurer());
        return (
          <div key={node.id} data-node-id={node.id}>
            <div data-table-title="" data-db-hover={layout.noted ? '' : undefined}>
              {node.title}
            </div>
            <TableBody nodeId={node.id} layout={layout} focused />
          </div>
        );
      })}
      <DbPopover deck={deck} />
      <EnumPopover deck={deck} />
    </>
  );
}

function setup() {
  const { wrapper, doc, editor } = editorWrapper(file);
  render(<Cards doc={doc} />, { wrapper });
  return { editor };
}

const row = (name: RegExp) => screen.getByRole('listitem', { name });
const open = (target: Parameters<ReturnType<typeof useUiStore.getState>['openDbPopover']>[0]) => {
  act(() => {
    useUiStore.getState().openDbPopover(target);
  });
};

/** The pointer rests on `element`, as the canvas's delegated pointer-over reports it. */
function rest(element: Element | null) {
  act(() => {
    pointerOver(element, 'mouse');
    vi.advanceTimersByTime(DB_REST_MS);
  });
}

describe('column popover (064 US1)', () => {
  afterEach(() => {
    act(() => {
      pointerOver(null, 'mouse');
    });
    cancelDbHover();
    vi.useRealTimers();
  });

  it('shows the name, full type, constraints and the note as plain text', () => {
    setup();
    open({ kind: 'column', nodeId: 'users', columnId: 'email', source: 'hover' });
    const dialog = screen.getByRole('dialog', { name: 'Column email' });
    expect(dialog).toHaveTextContent('varchar(320)');
    expect(within(dialog).getByRole('list', { name: 'Constraints' })).toHaveTextContent('Not null');
    expect(within(dialog).getByText('Note')).toBeInTheDocument();
    const note = within(dialog).getByText(/Used for sign-in/);
    // Plain text: the tag is shown literally and the line break is kept.
    expect(note.textContent).toBe('Used for sign-in\nnever shown <b>publicly</b>');
    expect(note.querySelector('b')).toBeNull();
    // A hover never takes focus.
    expect(dialog).not.toContainElement(document.activeElement as HTMLElement);
  });

  it('reads the content out once when opened by keyboard focus (FR-009)', () => {
    setup();
    open({ kind: 'column', nodeId: 'users', columnId: 'email', source: 'keyboard' });
    expect(useUiStore.getState().announcement.text).toBe(
      'email, varchar(320), Not null, note: Used for sign-in\nnever shown <b>publicly</b>',
    );
    open({ kind: 'table', nodeId: 'users', source: 'keyboard' });
    expect(useUiStore.getState().announcement.text).toBe('users, note: Stores registered users');
  });

  it('has no Note section for a column without a note', () => {
    setup();
    open({ kind: 'column', nodeId: 'users', columnId: 'created', source: 'hover' });
    const dialog = screen.getByRole('dialog', { name: 'Column created_at' });
    expect(dialog).toHaveTextContent('Default now()');
    expect(within(dialog).queryByText('Note')).not.toBeInTheDocument();
  });

  it('"Open details" opens the drawer on the column and closes', async () => {
    const user = userEvent.setup();
    setup();
    open({ kind: 'column', nodeId: 'users', columnId: 'email', source: 'hover' });
    await user.click(screen.getByRole('button', { name: 'Open details' }));
    const ui = useUiStore.getState();
    expect(ui.drawer.open).toBe(true);
    expect(ui.tableDrawer.expandedColumnId).toBe('email');
    expect(ui.selection.nodes).toEqual(['users']);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    setup();
    open({ kind: 'column', nodeId: 'users', columnId: 'email', source: 'click' });
    await screen.findByRole('dialog', { name: 'Column email' });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('follows a rename while open and closes when the column is removed', () => {
    const { editor } = setup();
    open({ kind: 'column', nodeId: 'users', columnId: 'email', source: 'click' });
    act(() => {
      editor().updateColumn('users', 'email', { name: 'mail' });
    });
    expect(screen.getByRole('dialog', { name: 'Column mail' })).toBeInTheDocument();
    act(() => {
      editor().removeColumn('users', 'email');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useUiStore.getState().dbPopover).toBeNull();
  });

  it('opens on hover rest only over rows with hidden information', () => {
    vi.useFakeTimers();
    setup();
    rest(row(/^name, text/));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rest(row(/^created_at/));
    expect(screen.getByRole('dialog', { name: 'Column created_at' })).toBeInTheDocument();
  });

  it('never shows with the enum popover (FR-011)', () => {
    setup();
    open({ kind: 'column', nodeId: 'users', columnId: 'role', source: 'hover' });
    act(() => {
      useUiStore.getState().openEnumPopover({ nodeId: 'users', columnId: 'role', source: 'hover' });
    });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'user_role' })).toBeInTheDocument();
  });

  it('opens nothing over the enum chip itself', () => {
    vi.useFakeTimers();
    setup();
    rest(screen.getByRole('button', { name: 'user_role values' }));
    expect(useUiStore.getState().dbPopover).toBeNull();
  });
});

describe('table popover (064 US2)', () => {
  afterEach(() => {
    act(() => {
      pointerOver(null, 'mouse');
    });
    cancelDbHover();
    vi.useRealTimers();
  });

  it('shows the table name and its full note; "Open details" opens the table', async () => {
    const user = userEvent.setup();
    setup();
    open({ kind: 'table', nodeId: 'users', source: 'click' });
    const dialog = await screen.findByRole('dialog', { name: 'Table users' });
    expect(dialog).toHaveTextContent('Stores registered users');
    await user.click(within(dialog).getByRole('button', { name: 'Open details' }));
    expect(useUiStore.getState().tableDrawer.tab).toBe('general');
    expect(useUiStore.getState().selection.nodes).toEqual(['users']);
  });

  it('opens on the noted title, never on a title without a note', () => {
    vi.useFakeTimers();
    setup();
    const titles = document.querySelectorAll('[data-table-title]');
    rest(titles[1] ?? null);
    expect(useUiStore.getState().dbPopover).toBeNull();
    rest(titles[0] ?? null);
    expect(screen.getByRole('dialog', { name: 'Table users' })).toBeInTheDocument();
  });

  it('a table without a note never gets a popover, even when asked', () => {
    setup();
    open({ kind: 'table', nodeId: 'audit', source: 'click' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useUiStore.getState().dbPopover).toBeNull();
  });

  it('switches from the title to a hidden row of the same table at once (FR-006)', () => {
    vi.useFakeTimers();
    setup();
    rest(document.querySelector('[data-table-title]'));
    act(() => {
      pointerOver(row(/^email/), 'mouse');
    });
    expect(screen.getByRole('dialog', { name: 'Column email' })).toBeInTheDocument();
  });
});
