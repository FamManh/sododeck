import { NEW_DECK_PACKS, toJSON } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { Palette } from './palette';
import { NOTE_MIME, TYPE_MIME } from './use-canvas-handlers';

const newDeck = () => deckOf({ packs: [...NEW_DECK_PACKS] });
/** Every pack on, Logistics included (off in a new deck since 051). */
const allPacksDeck = () => deckOf({ packs: [...NEW_DECK_PACKS, 'logistics'] });
const tileNames = () =>
  within(screen.getByRole('grid', { name: 'Types' }))
    .getAllByRole('button')
    .map((b) => b.textContent.replace(/\d+$/, ''));

describe('Palette: Database tab (043 US7, R13)', () => {
  it('lists Table, Note, Table group and Enum with their letter keys', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('tab', { name: 'Database' }));
    const tiles = within(screen.getByRole('grid', { name: 'Types' })).getAllByRole('button');
    expect(tiles.map((b) => b.textContent)).toEqual(['TableT', 'NoteS', 'Table groupG', 'Enum']);
  });

  it('adds a table with an id key column from the Table tile, its title in edit', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('tab', { name: 'Database' }));
    await user.click(screen.getByRole('button', { name: 'Table' }));
    const table = toJSON(doc).nodes[0];
    expect(table).toMatchObject({ type: 'db-table', title: 'table_1' });
    expect(table?.columns).toEqual([
      { id: expect.any(String) as string, name: 'id', type: 'integer', pk: true, notNull: true },
    ]);
    expect(useUiStore.getState().titleEdit?.id).toBe(table?.id);
  });

  it('places a frame from Table group with nothing selected', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('tab', { name: 'Database' }));
    await user.click(screen.getByRole('button', { name: 'Table group' }));
    expect(toJSON(doc).groups).toHaveLength(1);
  });

  it('adds an enum from the Enum tile: enum_1, its drawer open with the name selected (052)', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('tab', { name: 'Database' }));
    await user.click(screen.getByRole('button', { name: 'Enum' }));
    const added = toJSON(doc).enums?.[0];
    expect(added).toMatchObject({ name: 'enum_1', values: [] });
    const ui = useUiStore.getState();
    expect(ui.drawer).toMatchObject({ open: true, mode: 'enum', enumId: added?.id });
    expect(ui.enumNameSelect).toBe(added?.id);
    await user.click(screen.getByRole('button', { name: 'Enum' }));
    expect(toJSON(doc).enums?.map((e) => e.name)).toEqual(['enum_1', 'enum_2']);
  });

  it('does not drag the Enum tile onto the canvas (052)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('tab', { name: 'Database' }));
    expect(screen.getByRole('button', { name: 'Enum' })).not.toHaveAttribute('draggable', 'true');
  });

  it('hides the tab when the Database pack is off', () => {
    renderWithEditor(
      <Palette />,
      deckOf({ packs: NEW_DECK_PACKS.filter((pack) => pack !== 'database') }),
    );
    expect(screen.queryByRole('tab', { name: 'Database' })).toBeNull();
  });
});

describe('Palette: Add flyout (030)', () => {
  it('a new deck shows six tabs, five sections in display order with counts 13 / 3 / 1 / 4 / 7 and the packs footer (051 US7)', () => {
    renderWithEditor(<Palette />, newDeck());
    expect(
      within(screen.getByRole('tablist', { name: 'Categories' }))
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['All', 'Shapes', 'Process', 'Data', 'Database', 'Architecture']);
    const sections = screen.getAllByRole('group');
    expect(sections.map((s) => within(s).getByRole('heading').textContent)).toEqual([
      'Basic shapes13',
      'Process3',
      'Data1',
      'Database4',
      'Architecture7',
    ]);
    expect(screen.getByRole('button', { name: 'Packs · 5 on' })).toBeInTheDocument();
    expect(tileNames()).toHaveLength(28);
    // The Database tiles show their letter key (043).
    expect(tileNames()).toContain('TableT');
    expect(tileNames()).not.toContain('Warehouse');
  });

  it('turning Logistics on shows its tiles last (051 US7)', () => {
    const { editor } = renderWithEditor(<Palette />, newDeck());
    act(() => {
      editor().setPackOn('logistics', true);
    });
    const sections = screen.getAllByRole('group');
    expect(within(sections.at(-1) ?? document.body).getByRole('heading').textContent).toBe(
      'Logistics2',
    );
    expect(tileNames().slice(-2)).toEqual(['Warehouse', 'Truck route']);
  });

  it('the Shapes tab lists the eleven shapes with mini outlines, then Sticky and Frame (031)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('tab', { name: 'Shapes' }));
    expect(tileNames()).toEqual([
      'Rectangle',
      'Rounded rectangle',
      'Ellipse',
      'Diamond',
      'Pill',
      'Cylinder',
      'Document',
      'Parallelogram',
      'Hexagon',
      'Actor',
      'Text',
      'Sticky',
      'Frame',
    ]);
    const parallelogram = screen.getByRole('button', { name: 'Parallelogram' });
    expect(within(parallelogram).getByTestId('shape-glyph')).toHaveAttribute(
      'data-geometry',
      'parallelogram',
    );
    expect(screen.getAllByRole('gridcell')).toHaveLength(13);
  });

  it('adding a shape tile creates that shape at its default size, title in edit (031)', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('button', { name: 'Diamond' }));
    const [node] = toJSON(doc).nodes;
    expect(node).toMatchObject({ type: 'diamond', title: 'Untitled diamond' });
    // No stored size: the shape draws at its default (176 × 112).
    expect(node?.size).toBeUndefined();
    expect(useUiStore.getState().titleEdit).toMatchObject({ target: 'node', id: node?.id });
  });

  it('the Sticky tile adds today’s sticky note, like the rail tool (031 US4)', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('button', { name: 'Sticky' }));
    expect(toJSON(doc).stickies).toHaveLength(1);
    expect(toJSON(doc).nodes).toEqual([]);
    const drag = new Map<string, string>();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Sticky' }), {
      dataTransfer: { setData: (k: string, v: string) => drag.set(k, v), effectAllowed: '' },
    });
    expect(drag.get(NOTE_MIME)).toBe('note');
  });

  it('says what the Sticky tile does when it takes focus', async () => {
    renderWithEditor(<Palette />, newDeck());
    act(() => {
      screen.getByRole('button', { name: 'Sticky' }).focus();
    });
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/drag to drop/);
  });

  it('draws the Sticky tile as a pad of three notes in the last colour (053 US3)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('tab', { name: 'Shapes' }));
    const pad = within(screen.getByRole('button', { name: 'Sticky' })).getByTestId('sticky-pad');
    const sheets = pad.querySelectorAll('[data-slot="sticky-paper"]');
    expect(sheets).toHaveLength(3);
    expect([...sheets].every((sheet) => sheet.getAttribute('data-color') === 'amber')).toBe(true);
    act(() => {
      useUiStore.getState().setLastStickyColour('green');
    });
    expect(
      within(screen.getByRole('button', { name: 'Sticky' }))
        .getByTestId('sticky-pad')
        .querySelector('[data-slot="sticky-paper"]'),
    ).toHaveAttribute('data-color', 'green');
  });

  it('the Sticky tile places a note in the last colour, ready for typing (053 US3)', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, newDeck());
    act(() => {
      useUiStore.getState().setLastStickyColour('clay');
    });
    await user.click(screen.getByRole('button', { name: 'Sticky' }));
    const [sticky] = toJSON(doc).stickies;
    expect(sticky).toMatchObject({ text: '', color: 'clay' });
    expect(useUiStore.getState().stickyEditing).toBe(sticky?.id);
  });

  it('the Frame tile arms the frame tool on click; Enter places a frame (031 US2)', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, newDeck());
    const frame = screen.getByRole('button', { name: 'Frame' });
    await user.click(frame);
    expect(useUiStore.getState().tool).toBe('frame');
    expect(frame).toHaveAttribute('aria-pressed', 'true');
    act(() => {
      useUiStore.getState().setTool('select');
    });
    frame.focus();
    await user.keyboard('{Enter}');
    expect(toJSON(doc).groups).toMatchObject([
      { title: 'New group', size: { width: 320, height: 200 } },
    ]);
  });

  it('turning Basic shapes off hides its tiles; shapes on the board are not touched', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, deckOf({ packs: ['architecture'] }));
    expect(screen.queryByRole('tab', { name: 'Shapes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Frame' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search types' }), 'sticky');
    expect(screen.getByText('No types match')).toBeInTheDocument();
  });

  it('offers Import SQL or DBML in the footer when the Database pack is on (044)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('button', { name: 'Import SQL or DBML…' }));
    expect(useUiStore.getState().importDialog.open).toBe(true);
  });

  it('a deck from before packs lists only Architecture', () => {
    renderWithEditor(<Palette />);
    expect(
      within(screen.getByRole('tablist', { name: 'Categories' }))
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['All', 'Architecture']);
    expect(tileNames()).toEqual([
      'Service',
      'Database',
      'Gateway',
      'Client',
      'Queue',
      'External',
      'Component',
    ]);
    expect(screen.getByRole('button', { name: 'Packs · 1 on' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import SQL or DBML…' })).not.toBeInTheDocument();
  });

  it('offers the Note card drawn as a pad, and its help text (053 US3)', () => {
    renderWithEditor(<Palette />);
    const card = screen.getByRole('button', { name: 'Note' });
    expect(within(card).getByTestId('sticky-pad')).toBeInTheDocument();
    expect(screen.getByText(/Drag Note onto the canvas for a free note/)).toBeInTheDocument();
  });

  it('filters by name, hides empty sections, says when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, allPacksDeck());
    const search = screen.getByRole('searchbox', { name: 'Search types' });
    await user.type(search, 'TRUCK');
    expect(tileNames()).toEqual(['Truck route']);
    expect(screen.getAllByRole('group')).toHaveLength(1);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('No types match')).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'Types' })).not.toBeInTheDocument();
  });

  it('Enter in the search adds the first match', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, allPacksDeck());
    await user.type(screen.getByRole('searchbox', { name: 'Search types' }), 'ware{Enter}');
    expect(toJSON(doc).nodes).toMatchObject([{ type: 'warehouse', title: 'Untitled warehouse' }]);
  });

  it('the selected tab filters the sections, and arrows move between tabs', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('tab', { name: 'Process' }));
    expect(tileNames()).toEqual(['Task', 'Decision', 'Document']);
    expect(screen.getByRole('tab', { name: 'Process' })).toHaveAttribute('aria-selected', 'true');
    screen.getByRole('tab', { name: 'Process' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Data' })).toHaveAttribute('aria-selected', 'true');
    expect(tileNames()).toEqual(['Issue']);
  });

  it('arrow keys move through the grid in three columns', async () => {
    const user = userEvent.setup();
    // Architecture then Logistics in display order: Down from a short last row enters the next section.
    renderWithEditor(<Palette />, deckOf({ packs: ['architecture', 'logistics'] }));
    const tile = (name: string) => screen.getByRole('button', { name });
    act(() => {
      tile('Service').focus();
    });
    await user.keyboard('{ArrowRight}');
    expect(tile('Database')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(tile('Queue')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(tile('Truck route')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(tile('Component')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(tile('Queue')).toHaveFocus();
  });

  it('adds "Untitled <type>" on click and on Enter, selects and announces it', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />);
    await user.click(screen.getByRole('button', { name: 'Service' }));
    const [node] = toJSON(doc).nodes;
    expect(node).toMatchObject({ type: 'service', title: 'Untitled service' });
    expect(Number.isInteger(node?.position?.x)).toBe(true);
    const ui = useUiStore.getState();
    expect(ui.selection).toEqual({ nodes: [node?.id], edges: [], groups: [], stickies: [] });
    expect(ui.focusedId).toBe(node?.id);
    expect(ui.announcement.text).toBe('Added Untitled service');

    screen.getByRole('button', { name: 'Database' }).focus();
    await user.keyboard('{Enter}');
    expect(toJSON(doc).nodes.map((n) => n.title)).toEqual([
      'Untitled service',
      'Untitled database',
    ]);
  });

  it('offsets a second add at the same spot', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />, deckOf({}));
    await user.click(screen.getByRole('button', { name: 'Service' }));
    await user.click(screen.getByRole('button', { name: 'Service' }));
    const [a, b] = toJSON(doc).nodes;
    expect(b?.position).toEqual({ x: (a?.position?.x ?? 0) + 24, y: (a?.position?.y ?? 0) + 24 });
  });

  it('is a drag source for the type id', () => {
    renderWithEditor(<Palette />, allPacksDeck());
    const card = screen.getByRole('button', { name: 'Truck route' });
    expect(card).toHaveAttribute('draggable', 'true');
    const data = new Map<string, string>();
    fireEvent.dragStart(card, {
      dataTransfer: { setData: (k: string, v: string) => data.set(k, v), effectAllowed: '' },
    });
    expect(data.get(TYPE_MIME)).toBe('truck-route');
  });

  it('numbers the first nine visible tiles and publishes them for the keys', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
    const numbers = screen.getAllByRole('button').filter((b) => /\d$/.test(b.textContent));
    // Display order (051): Basic shapes first.
    expect(numbers.map((b) => b.textContent)).toEqual([
      'Rectangle1',
      'Rounded rectangle2',
      'Ellipse3',
      'Diamond4',
      'Pill5',
      'Cylinder6',
      'Document7',
      'Parallelogram8',
      'Hexagon9',
    ]);
    // Types only: the Sticky and Frame tiles are never a number key (031).
    expect(useUiStore.getState().addFlyout.visible).toHaveLength(23);
    await user.type(screen.getByRole('searchbox', { name: 'Search types' }), 'serv');
    expect(useUiStore.getState().addFlyout.visible[0]).toBe('service');
  });

  it('adds and drags a Note card', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Palette />);

    await user.click(screen.getByRole('button', { name: 'Note' }));
    const [sticky] = toJSON(doc).stickies;
    expect(sticky).toMatchObject({ text: '' });
    expect(useUiStore.getState().stickyDraft).toBe(sticky?.id);

    const card = screen.getByRole('button', { name: 'Note' });
    const data = new Map<string, string>();
    fireEvent.dragStart(card, {
      dataTransfer: { setData: (k: string, v: string) => data.set(k, v), effectAllowed: '' },
    });
    expect(data.get(NOTE_MIME)).toBe('note');
  });

  it('turning a pack off removes its tiles and leaves board cards alone', () => {
    const file = deckOf({
      packs: [...NEW_DECK_PACKS, 'logistics'],
      nodes: [{ id: 'w', type: 'warehouse', title: 'Hub', position: { x: 0, y: 0 } }],
    });
    const { editor, doc } = renderWithEditor(<Palette />, file);
    expect(tileNames()).toContain('Warehouse');
    act(() => {
      editor().setPackOn('logistics', false);
    });
    expect(tileNames()).not.toContain('Warehouse');
    expect(tileNames()).not.toContain('Truck route');
    expect(toJSON(doc).nodes.map((n) => n.type)).toEqual(['warehouse']);
  });

  it('opens the packs view from the footer and Back returns to Add', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
    await user.click(screen.getByRole('button', { name: 'Packs · 5 on' }));
    expect(screen.getByRole('heading', { name: 'Packs in this deck' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Add' }));
    expect(screen.getByRole('searchbox', { name: 'Search types' })).toBeInTheDocument();
  });
});
