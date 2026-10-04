import { NEW_DECK_PACKS, toJSON } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { Palette } from './palette';
import { NOTE_MIME, TYPE_MIME } from './use-canvas-handlers';

const newDeck = () => deckOf({ packs: [...NEW_DECK_PACKS] });
const tileNames = () =>
  within(screen.getByRole('grid', { name: 'Types' }))
    .getAllByRole('button')
    .map((b) => b.textContent.replace(/\d+$/, ''));

describe('Palette: Add flyout (030)', () => {
  it('a new deck shows seven tabs, six sections with counts 7 / 3 / 2 / 1 / 1 / 13 and the packs footer', () => {
    renderWithEditor(<Palette />, newDeck());
    expect(
      within(screen.getByRole('tablist', { name: 'Categories' }))
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['All', 'Architecture', 'Process', 'Logistics', 'Data', 'Database', 'Shapes']);
    const sections = screen.getAllByRole('group');
    expect(sections.map((s) => within(s).getByRole('heading').textContent)).toEqual([
      'Architecture7',
      'Process3',
      'Logistics2',
      'Data1',
      'Database1',
      'Basic shapes13',
    ]);
    expect(screen.getByRole('button', { name: 'Packs · 6 on' })).toBeInTheDocument();
    expect(tileNames()).toHaveLength(27);
    expect(tileNames()).toContain('Table');
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
  });

  it('offers the Note card and its help text', () => {
    renderWithEditor(<Palette />);
    expect(screen.getByRole('button', { name: 'Note' })).toBeInTheDocument();
    expect(screen.getByText(/Drag Note onto a node to pin it/)).toBeInTheDocument();
  });

  it('filters by name, hides empty sections, says when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
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
    const { doc } = renderWithEditor(<Palette />, newDeck());
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
    expect(screen.getByRole('tab', { name: 'Logistics' })).toHaveAttribute('aria-selected', 'true');
    expect(tileNames()).toEqual(['Warehouse', 'Truck route']);
  });

  it('arrow keys move through the grid in three columns', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Palette />, newDeck());
    const tile = (name: string) => screen.getByRole('button', { name });
    act(() => {
      tile('Service').focus();
    });
    await user.keyboard('{ArrowRight}');
    expect(tile('Database')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(tile('Queue')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(tile('Decision')).toHaveFocus();
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
    renderWithEditor(<Palette />, newDeck());
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
    expect(numbers.map((b) => b.textContent)).toEqual([
      'Service1',
      'Database2',
      'Gateway3',
      'Client4',
      'Queue5',
      'External6',
      'Component7',
      'Task8',
      'Decision9',
    ]);
    // Types only: the Sticky and Frame tiles are never a number key (031).
    expect(useUiStore.getState().addFlyout.visible).toHaveLength(25);
    await user.type(screen.getByRole('searchbox', { name: 'Search types' }), 'e');
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
      packs: [...NEW_DECK_PACKS],
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
    await user.click(screen.getByRole('button', { name: 'Packs · 6 on' }));
    expect(screen.getByRole('heading', { name: 'Packs in this deck' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Add' }));
    expect(screen.getByRole('searchbox', { name: 'Search types' })).toBeInTheDocument();
  });
});
