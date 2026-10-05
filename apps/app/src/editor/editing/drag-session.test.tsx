import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { toJSON } from '@sododeck/model';
import type { Frame, SododeckFile } from '@sododeck/schema';
import { useToast } from '@sododeck/ui/components/toast';
import { act, renderHook, screen } from '@testing-library/react';
import type { Node, NodeChange } from '@xyflow/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { groupBounds } from '../canvas-geometry';
import { schemaGroupedDeck } from '../schema-groups';
import { useCanvasHandlers } from '../use-canvas-handlers';
import {
  cancelActiveGesture,
  hasActiveGesture,
  nudgeActiveDrag,
  setActiveGesture,
} from './drag-session';
import { applyResize, endResize, startResize } from './frame-resize';

const ui = () => useUiStore.getState();
const frame = (x: number, y: number, width: number, height: number): Frame => ({
  position: { x, y },
  size: { width, height },
});
const flowNode = (id: string) => ({ id }) as Node;
const pointer = (x: number, y: number, patch: Partial<ReactMouseEvent> = {}) =>
  ({
    clientX: x,
    clientY: y,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    ...patch,
  }) as ReactMouseEvent;

/**
 * Payments (with Fraud inside it) at the top left, Shop far to the right, a loose card far
 * below. Everything is far apart so snapping never interferes unless a test wants it.
 */
const deck: SododeckFile = deckOf({
  nodes: [
    { id: 'm1', type: 'service', title: 'Charge', group: 'pay', position: { x: 0, y: 0 } },
    { id: 'm2', type: 'service', title: 'Refund', group: 'pay', position: { x: 300, y: 0 } },
    { id: 'm3', type: 'service', title: 'Score', group: 'fraud', position: { x: 0, y: 300 } },
    { id: 's1', type: 'service', title: 'Cart', group: 'shop', position: { x: 3000, y: 0 } },
    { id: 'c', type: 'service', title: 'Fraud check', position: { x: 0, y: 3000 } },
  ],
  groups: [
    { id: 'pay', title: 'Payments', ...frame(-48, -48, 560, 540) },
    { id: 'fraud', title: 'Fraud', parent: 'pay', ...frame(-24, 276, 212, 152) },
    { id: 'shop', title: 'Shop', ...frame(2900, -100, 800, 800) },
  ],
});

function setup(file: SododeckFile = deck) {
  const env = editorWrapper(file);
  const { result } = renderHook(() => useCanvasHandlers(), { wrapper: env.wrapper });
  return { ...env, h: () => result.current };
}

const move = (id: string, x: number, y: number): NodeChange[] => [
  { type: 'position', id, position: { x, y }, dragging: true },
];
const position = (file: SododeckFile, id: string) => file.nodes.find((n) => n.id === id)?.position;
const frameOf = (file: SododeckFile, id: string) => {
  const g = file.groups.find((group) => group.id === id);
  return g?.position === undefined || g.size === undefined
    ? undefined
    : { position: g.position, size: g.size };
};

describe('dragging a group frame (016 US2, R5)', () => {
  it('moves the frame, nested frames and every member by the delta, as one undo step', () => {
    const { h, doc, editor } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('group:pay'));
      h().onNodesChange(move('group:pay', -48 + 50, -48 + 20));
      h().onNodesChange(move('group:pay', -48 + 100, -48 + 40));
    });
    expect(ui().canvasGesture).toBe('group-drag');
    expect(ui().dragReadout).toEqual({ dx: 100, dy: 40 });
    expect(ui().selection.groups).toEqual(['pay']);
    act(() => {
      h().onNodeDragStop(pointer(0, 0));
    });
    const file = toJSON(doc);
    expect(frameOf(file, 'pay')).toEqual(frame(52, -8, 560, 540));
    expect(frameOf(file, 'fraud')).toEqual(frame(76, 316, 212, 152));
    expect(position(file, 'm1')).toEqual({ x: 100, y: 40 });
    expect(position(file, 'm3')).toEqual({ x: 100, y: 340 });
    expect(position(file, 's1')).toEqual({ x: 3000, y: 0 });
    expect(ui().dragReadout).toBeNull();
    expect(ui().canvasGesture).toBeNull();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(deck);
    expect(editor().canUndo()).toBe(false);
  });

  it('a collapsed group drags by its card: frame, nested frames and members follow', () => {
    const { h, doc, editor } = setup();
    // The collapsed card sits wherever it is drawn; the drag moves by the card's own delta.
    const card = { id: 'collapsed:pay', position: { x: 100, y: 100 } } as Node;
    act(() => {
      h().onNodeDragStart({}, card);
      // ⌘ turns snapping off: this is about what moves, not where it lands.
      h().onNodeDrag(pointer(0, 0, { metaKey: true }));
      h().onNodesChange(move('collapsed:pay', 150, 120));
    });
    expect(ui().canvasGesture).toBe('group-drag');
    expect(ui().selection.groups).toEqual(['pay']);
    act(() => {
      h().onNodeDragStop(pointer(0, 0));
    });
    const file = toJSON(doc);
    expect(frameOf(file, 'pay')).toEqual(frame(2, -28, 560, 540));
    expect(frameOf(file, 'fraud')).toEqual(frame(26, 296, 212, 152));
    expect(position(file, 'm1')).toEqual({ x: 50, y: 20 });
    expect(position(file, 's1')).toEqual({ x: 3000, y: 0 });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(deck);
  });

  it('locks the axis with ⇧', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('group:pay'));
      h().onNodeDrag(pointer(10, 10, { shiftKey: true }));
      h().onNodesChange(move('group:pay', -48 + 100, -48 + 30));
      h().onNodeDragStop(pointer(10, 10));
    });
    expect(position(toJSON(doc), 'm1')).toEqual({ x: 100, y: 0 });
  });

  it('cancels with Esc: everything back, no undo entry', () => {
    const { h, doc, editor } = setup();
    act(() => {
      editor().update('nodes', 'c', { title: 'Before' });
    });
    const before = toJSON(doc);
    act(() => {
      h().onNodeDragStart({}, flowNode('group:pay'));
      h().onNodesChange(move('group:pay', 200, 200));
    });
    let cancelled = false;
    act(() => {
      cancelled = cancelActiveGesture();
    });
    expect(cancelled).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(ui().announcement.text).toBe('Cancelled');
    act(() => {
      // The rest of the drag is ignored.
      h().onNodesChange(move('group:pay', 400, 400));
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(toJSON(doc)).toEqual(before);
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes.find((n) => n.id === 'c')?.title).toBe('Fraud check');
  });

  it('adds 1 / 10 px with the arrows during the drag (§g-45)', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('group:pay'));
      h().onNodesChange(move('group:pay', -48 + 100, -48));
      nudgeActiveDrag(1, 0);
      nudgeActiveDrag(0, 10);
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(position(toJSON(doc), 'm1')).toEqual({ x: 101, y: 10 });
  });

  it('duplicates the whole group with ⌥, the original frame staying put', () => {
    const { h, doc, editor } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('group:pay'));
      // ⌥ held while dragging (051: the copy appears during the drag, not on release).
      h().onNodeDrag(pointer(0, 0, { altKey: true }));
      h().onNodesChange(move('group:pay', -48 + 1000, -48 + 1000));
    });
    // Mid-drag: the original frame and its members stay, the copied group follows.
    const during = toJSON(doc);
    expect(frameOf(during, 'pay')).toEqual(frame(-48, -48, 560, 540));
    expect(position(during, 'm1')).toEqual({ x: 0, y: 0 });
    expect(during.groups.find((g) => g.title === 'Payments' && g.id !== 'pay')?.position).toEqual({
      x: 952,
      y: 952,
    });
    act(() => {
      h().onNodeDragStop(pointer(0, 0, { altKey: true }));
    });
    const file = toJSON(doc);
    expect(frameOf(file, 'pay')).toEqual(frame(-48, -48, 560, 540));
    expect(file.groups).toHaveLength(5);
    expect(file.nodes).toHaveLength(8);
    const copy = file.groups.find((g) => g.title === 'Payments' && g.id !== 'pay');
    expect(copy?.position).toEqual({ x: 952, y: 952 });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(deck);
  });

  it('nests a group dropped inside another frame, with an Undo toast', async () => {
    const { h, doc, editor } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('group:fraud'));
      h().onNodesChange(move('group:fraud', 3100, 100));
      h().onNodeDrag(pointer(3150, 150));
    });
    expect(ui().dropTarget).toBe('shop');
    act(() => {
      h().onNodeDragStop(pointer(3150, 150));
    });
    const file = toJSON(doc);
    expect(file.groups.find((g) => g.id === 'fraud')?.parent).toBe('shop');
    // Members keep their group; frames never grow (FR-046).
    expect(file.nodes.find((n) => n.id === 'm3')?.group).toBe('fraud');
    expect(frameOf(file, 'shop')).toEqual(frame(2900, -100, 800, 800));
    expect(ui().announcement.text).toBe('Moved Fraud into Shop');
    expect(await screen.findByText('Moved Fraud into Shop')).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(deck);
  });

  it('never nests a group into itself, and leaves the parent when dropped outside it', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('group:fraud'));
      h().onNodesChange(move('group:fraud', 1500, 1500));
      h().onNodeDrag(pointer(1550, 1550));
      h().onNodeDragStop(pointer(1550, 1550));
    });
    expect(toJSON(doc).groups.find((g) => g.id === 'fraud')).not.toHaveProperty('parent');
    expect(ui().announcement.text).toBe('Moved Fraud out of Payments');
  });
});

describe('a locked group refuses move and resize (054 FR-013)', () => {
  const lockedDeck: SododeckFile = {
    ...deck,
    nodes: deck.nodes.map((n) =>
      n.group === 'pay' || n.group === 'fraud' ? { ...n, locked: true } : n,
    ),
  };

  it('refuses a frame drag and says why, changing nothing', () => {
    const { h, doc, editor } = setup(lockedDeck);
    act(() => {
      h().onNodeDragStart({}, flowNode('group:pay'));
      h().onNodesChange(move('group:pay', -48 + 100, -48 + 40));
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(toJSON(doc)).toEqual(lockedDeck);
    expect(editor().canUndo()).toBe(false);
    expect(ui().announcement.text).toBe('Locked · unlock to move or edit');
    expect(ui().canvasGesture).toBeNull();
  });

  it('refuses a collapsed group card drag the same way', () => {
    const { h, doc } = setup(lockedDeck);
    act(() => {
      h().onNodeDragStart({}, { id: 'collapsed:pay', position: { x: 100, y: 100 } } as Node);
      h().onNodesChange(move('collapsed:pay', 150, 120));
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(toJSON(doc)).toEqual(lockedDeck);
  });

  it('refuses to resize the frame', () => {
    const { doc, editor } = setup(lockedDeck);
    let session: ReturnType<typeof startResize> = null;
    act(() => {
      session = startResize(editor(), 'pay', 'bottom-right');
    });
    expect(session).toBeNull();
    expect(toJSON(doc)).toEqual(lockedDeck);
    expect(ui().announcement.text).toBe('Locked · unlock to move or edit');
  });

  it('still moves a group that has one unlocked card', () => {
    const partly: SododeckFile = {
      ...deck,
      nodes: deck.nodes.map((n) => (n.id === 'm1' ? { ...n, locked: true } : n)),
    };
    const { h, doc } = setup(partly);
    act(() => {
      h().onNodeDragStart({}, flowNode('group:pay'));
      h().onNodesChange(move('group:pay', -48 + 100, -48 + 40));
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(frameOf(toJSON(doc), 'pay')).toEqual(frame(52, -8, 560, 540));
  });
});

describe('dropping components into and out of groups (016 US4, R6)', () => {
  it('drops a card into the frame under the pointer, and the frame does not grow', () => {
    const { h, doc, editor } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('c'));
      h().onNodesChange(move('c', 3100, 300));
      h().onNodeDrag(pointer(3180, 350));
    });
    expect(ui().dropTarget).toBe('shop');
    act(() => {
      h().onNodeDragStop(pointer(3180, 350));
    });
    const file = toJSON(doc);
    expect(file.nodes.find((n) => n.id === 'c')?.group).toBe('shop');
    expect(frameOf(file, 'shop')).toEqual(frame(2900, -100, 800, 800));
    expect(ui().announcement.text).toBe('Moved Fraud check into Shop');
    expect(ui().dropTarget).toBeNull();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(deck);
  });

  it('takes a card out of its group when dropped outside every frame', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('m1'));
      h().onNodesChange(move('m1', 1500, 1500));
      h().onNodeDragStop(pointer(1550, 1550));
    });
    expect(toJSON(doc).nodes.find((n) => n.id === 'm1')).not.toHaveProperty('group');
    expect(ui().announcement.text).toBe('Moved Charge out of Payments');
  });

  it('keeps the card in its group while it moves inside the frame, with no highlight', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('m2'));
      h().onNodesChange(move('m2', 320, 40));
      h().onNodeDrag(pointer(350, 60));
    });
    expect(ui().dropTarget).toBeNull();
    act(() => {
      h().onNodeDragStop(pointer(350, 60));
    });
    expect(toJSON(doc).nodes.find((n) => n.id === 'm2')?.group).toBe('pay');
  });

  it('keeps membership with ⌥ (and drops a copy)', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('c'));
      h().onNodeDrag(pointer(3180, 350, { altKey: true }));
      h().onNodesChange(move('c', 3100, 300));
    });
    expect(ui().dropTarget).toBeNull();
    act(() => {
      h().onNodeDragStop(pointer(3180, 350, { altKey: true }));
    });
    const file = toJSON(doc);
    expect(file.nodes.find((n) => n.id === 'c')).not.toHaveProperty('group');
    expect(file.nodes.find((n) => n.id === 'c')?.position).toEqual({ x: 0, y: 3000 });
    expect(file.nodes.at(-1)).not.toHaveProperty('group');
  });
});

describe('dragging in By schema mode (048)', () => {
  const schemaDeck: SododeckFile = deckOf({
    groupingMode: 'schema',
    nodes: [
      { id: 't1', type: 'db-table', title: 'a', schema: 'billing', position: { x: 0, y: 0 } },
      { id: 't2', type: 'db-table', title: 'b', schema: 'billing', position: { x: 400, y: 0 } },
      { id: 'c', type: 'service', title: 'Loose', position: { x: 0, y: 3000 } },
    ],
  });

  it('never offers a derived schema frame as a drop target and writes no group id', () => {
    const { h, doc } = setup(schemaDeck);
    act(() => {
      h().onNodeDragStart({}, flowNode('c'));
      h().onNodesChange(move('c', 100, 50));
      h().onNodeDrag(pointer(150, 80));
    });
    expect(ui().dropTarget).toBeNull();
    act(() => {
      h().onNodeDragStop(pointer(150, 80));
    });
    expect(toJSON(doc).nodes.find((n) => n.id === 'c')).not.toHaveProperty('group');
    expect(toJSON(doc).groups).toEqual([]);
  });

  it('dragging a derived schema frame moves its tables and stores no frame', () => {
    const { h, doc } = setup(schemaDeck);
    const rect = groupBounds(schemaGroupedDeck(schemaDeck)).get('schema:billing');
    if (rect === undefined) throw new Error('Expected a derived frame');
    act(() => {
      h().onNodeDragStart({}, flowNode('group:schema:billing'));
      h().onNodesChange(move('group:schema:billing', rect.x + 50, rect.y + 20));
      h().onNodeDragStop(pointer(0, 0));
    });
    const file = toJSON(doc);
    expect(position(file, 't1')).toEqual({ x: 50, y: 20 });
    expect(position(file, 't2')).toEqual({ x: 450, y: 20 });
    expect(file.groups).toEqual([]);
  });

  it('a table dragged within its schema frame keeps its stored group untouched', () => {
    const { h, doc } = setup(schemaDeck);
    act(() => {
      h().onNodeDragStart({}, flowNode('t1'));
      h().onNodesChange(move('t1', 20, 20));
      h().onNodeDragStop(pointer(40, 40));
    });
    expect(toJSON(doc).nodes.find((n) => n.id === 't1')).not.toHaveProperty('group');
  });
});

describe('snapping (016 US3, R7)', () => {
  const lined: SododeckFile = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
    ],
  });

  it('snaps to another card’s edge within 6 px and shows a guide', () => {
    const { h, doc } = setup(lined);
    act(() => {
      h().onNodeDragStart({}, flowNode('b'));
      h().onNodesChange(move('b', 400, 300 + 4));
    });
    expect(ui().guides).toEqual([]);
    act(() => {
      h().onNodesChange(move('b', 3, 300));
    });
    expect(ui().guides.some((g) => g.axis === 'x' && g.at === 0)).toBe(true);
    act(() => {
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(position(toJSON(doc), 'b')).toEqual({ x: 0, y: 300 });
    expect(ui().guides).toEqual([]);
  });

  it('does not snap while ⌘ is held', () => {
    const { h, doc } = setup(lined);
    act(() => {
      h().onNodeDragStart({}, flowNode('b'));
      h().onNodeDrag(pointer(0, 0, { metaKey: true }));
      h().onNodesChange(move('b', 3, 300));
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(position(toJSON(doc), 'b')).toEqual({ x: 3, y: 300 });
  });

  it('snaps to a resized card’s own right edge, not the default card width (017 R2)', () => {
    const sized: SododeckFile = deckOf({
      nodes: [
        {
          id: 'a',
          type: 'service',
          title: 'A',
          position: { x: 0, y: 0 },
          size: { width: 400, height: 44 },
        },
        { id: 'b', type: 'service', title: 'B', position: { x: 800, y: 0 } },
      ],
    });
    const { h, doc } = setup(sized);
    act(() => {
      h().onNodeDragStart({}, flowNode('b'));
      h().onNodesChange(move('b', 403, 300));
    });
    expect(ui().guides.some((g) => g.axis === 'x' && g.at === 400)).toBe(true);
    act(() => {
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(position(toJSON(doc), 'b')).toEqual({ x: 400, y: 300 });
  });
});

describe('resizing a group frame (016 US2, FR-013–FR-015)', () => {
  it('resizes only the frame, clamped to the members plus padding, as one undo step', () => {
    const { doc, editor } = setup();
    act(() => {
      const session = startResize(editor(), 'pay', 'bottom-right');
      if (session === null) throw new Error('no frame');
      expect(ui().canvasGesture).toBe('resize');
      applyResize(
        editor(),
        session,
        { x: -48, y: -48, width: 700, height: 600 },
        { shift: false, alt: false },
      );
      // Past the members: stops at members + 24 px.
      applyResize(
        editor(),
        session,
        { x: -48, y: -48, width: 100, height: 100 },
        { shift: false, alt: false },
      );
      endResize(editor(), session);
    });
    const file = toJSON(doc);
    // Members span (0,0)–(484, 76) and the Fraud frame reaches y 428; plus 24 px.
    expect(frameOf(file, 'pay')).toEqual(frame(-48, -48, 484 + 24 + 48, 428 + 24 + 48));
    expect(file.nodes).toEqual(deck.nodes);
    expect(ui().canvasGesture).toBeNull();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(deck);
    expect(editor().canUndo()).toBe(false);
  });

  it('cancels with Esc', () => {
    const { doc, editor } = setup();
    act(() => {
      const session = startResize(editor(), 'pay', 'right');
      if (session === null) throw new Error('no frame');
      applyResize(
        editor(),
        session,
        { x: -48, y: -48, width: 900, height: 540 },
        { shift: false, alt: false },
      );
      expect(cancelActiveGesture()).toBe(true);
      endResize(editor(), session);
    });
    expect(toJSON(doc)).toEqual(deck);
    expect(editor().canUndo()).toBe(false);
  });
});

describe('marquee (016 US6, R13)', () => {
  it('counts the cards it selects and restores the old selection on Esc', () => {
    const { h } = setup();
    act(() => {
      ui().select({ nodes: ['c'] });
      h().onSelectionStart();
    });
    expect(ui().canvasGesture).toBe('marquee');
    expect(ui().marqueeCount).toBe(0);
    act(() => {
      h().onNodesChange([
        { type: 'select', id: 'm1', selected: true },
        { type: 'select', id: 'm2', selected: true },
      ]);
    });
    expect(ui().marqueeCount).toBe(3);
    act(() => {
      expect(cancelActiveGesture()).toBe(true);
    });
    expect(ui().selection.nodes).toEqual(['c']);
    expect(ui().canvasGesture).toBeNull();
    expect(ui().marqueeCount).toBeNull();
    act(() => {
      // React Flow keeps reporting until the pointer is released: ignored.
      h().onNodesChange([{ type: 'select', id: 's1', selected: true }]);
      h().onSelectionEnd();
    });
    expect(ui().selection.nodes).toEqual(['c']);
  });

  it('ends cleanly', () => {
    const { h } = setup();
    act(() => {
      h().onSelectionStart();
      h().onNodesChange([{ type: 'select', id: 'm1', selected: true }]);
      h().onSelectionEnd();
    });
    expect(ui().selection.nodes).toEqual(['m1']);
    expect(ui().canvasGesture).toBeNull();
    expect(ui().marqueeCount).toBeNull();
    expect(cancelActiveGesture()).toBe(false);
  });
});

describe('a drag survives re-rendered handlers (016 regression)', () => {
  it('keeps its session when a toast appears mid-drag, and closes its gesture', () => {
    const env = editorWrapper(deck);
    const { result } = renderHook(
      () => ({ handlers: useCanvasHandlers(), toast: useToast().toast }),
      { wrapper: env.wrapper },
    );
    act(() => {
      result.current.handlers.onNodeDragStart({}, flowNode('c'));
      result.current.handlers.onNodesChange(move('c', 1500, 1500));
    });
    act(() => {
      // Any toast changes the toast context and re-renders the handlers.
      result.current.toast({ message: 'Something else' });
    });
    act(() => {
      result.current.handlers.onNodesChange(move('c', 1600, 1600));
      result.current.handlers.onNodeDragStop(pointer(0, 0));
    });
    expect(position(toJSON(env.doc), 'c')).toEqual({ x: 1600, y: 1600 });
    // The gesture is closed: a later edit is an undo step of its own.
    act(() => {
      env.editor().update('nodes', 'c', { title: 'Renamed' });
      env.editor().undo();
    });
    expect(position(toJSON(env.doc), 'c')).toEqual({ x: 1600, y: 1600 });
  });

  it('closes a drag React Flow never stopped before the next one starts', () => {
    const { h, doc, editor } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('c'));
      h().onNodesChange(move('c', 1500, 1500));
      // No stop (an aborted drag); the next drag starts.
      h().onNodeDragStart({}, flowNode('m1'));
      h().onNodesChange(move('m1', 20, 20));
      h().onNodeDragStop(pointer(40, 40));
      editor().undo();
    });
    expect(position(toJSON(doc), 'm1')).toEqual({ x: 0, y: 0 });
    expect(position(toJSON(doc), 'c')).toEqual({ x: 1500, y: 1500 });
  });
});

describe('dragging a card with the Deck tilt (029 FR-016)', () => {
  const drop = (withTilt: boolean) => {
    const { h, doc } = setup();
    let host: HTMLElement | null = null;
    if (withTilt) {
      // What React Flow renders while a card is dragged: the tilt is a style on `.sd-card`.
      host = document.createElement('div');
      host.className = 'react-flow__node dragging';
      host.innerHTML = '<div class="sd-card"></div>';
      document.body.append(host);
    }
    act(() => {
      h().onNodeDragStart({}, flowNode('c'));
      h().onNodesChange(move('c', 120, 3040));
      h().onNodeDragStop(pointer(0, 0));
    });
    host?.remove();
    return position(toJSON(doc), 'c');
  };

  it('drops at the same position with and without the tilt class on the card', () => {
    expect(drop(true)).toEqual(drop(false));
  });

  it('keeps every transform on .sd-card, never on .react-flow__node', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (selector === undefined || body === undefined || !/(^|\s)transform\s*:/.test(body))
        continue;
      const targets = selector.split(',').map((part) => part.trim());
      for (const target of targets) {
        if (!target.includes('.react-flow__node')) continue;
        // A shape's tilt lives on its art (031), the card's on `.sd-card`.
        expect(target, `transform on ${target}`).toMatch(/\.sd-card|\.sd-shape-(art|lip)/);
      }
    }
  });
});

describe('hasActiveGesture (050 R9)', () => {
  it('is true between setActiveGesture(x) and setActiveGesture(null)', () => {
    expect(hasActiveGesture()).toBe(false);
    setActiveGesture({ cancel: () => true, arrow: () => false });
    expect(hasActiveGesture()).toBe(true);
    setActiveGesture(null);
    expect(hasActiveGesture()).toBe(false);
  });

  it('is true during a component drag and false after the DragController ends', () => {
    const { h } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('c'));
      h().onNodesChange(move('c', 40, 3020));
    });
    expect(hasActiveGesture()).toBe(true);
    act(() => {
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(hasActiveGesture()).toBe(false);
  });
});

describe('DragController always clears its guides (050 R9)', () => {
  const guide = { axis: 'x' as const, at: 10, from: 0, to: 100 };

  it('window blur mid-drag cancels the drag and clears the guides', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('c'));
      h().onNodesChange(move('c', 40, 3020));
      ui().setGuides([guide]);
    });
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(ui().guides).toHaveLength(0);
    expect(position(toJSON(doc), 'c')).toEqual({ x: 0, y: 3000 });
    // Later frames of the abandoned drag are ignored until React Flow ends it.
    act(() => {
      h().onNodesChange(move('c', 90, 3090));
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(position(toJSON(doc), 'c')).toEqual({ x: 0, y: 3000 });
    expect(ui().canvasGesture).toBeNull();
    expect(hasActiveGesture()).toBe(false);
  });

  it('clears the guides when a frame of the drag throws', () => {
    const { h, editor } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('c'));
      h().onNodesChange(move('c', 40, 3020));
      ui().setGuides([guide]);
    });
    const spy = vi.spyOn(editor(), 'moveInView').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => {
      h().onNodesChange(move('c', 80, 3040));
    }).toThrow('boom');
    expect(ui().guides).toHaveLength(0);
    spy.mockRestore();
    act(() => {
      h().onNodeDragStop(pointer(0, 0));
    });
  });
});

describe('locked cards in a multi-drag (043 FR-024)', () => {
  it('moves only the unlocked cards of the selection', () => {
    const { h, doc } = setup(
      deckOf({
        nodes: [
          { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
          { id: 'l', type: 'service', title: 'L', locked: true, position: { x: 0, y: 1000 } },
        ],
      }),
    );
    act(() => {
      ui().select({ nodes: ['a', 'l'] });
      h().onNodeDragStart({}, flowNode('a'));
      h().onNodesChange(move('a', 200, 100));
      h().onNodeDragStop(pointer(0, 0));
    });
    const file = toJSON(doc);
    expect(position(file, 'a')).toEqual({ x: 200, y: 100 });
    expect(position(file, 'l')).toEqual({ x: 0, y: 1000 });
  });
});

describe('⌥ duplicate-drag keeps the original in place (051 US2, R2)', () => {
  /** Three loose cards in a row with two connectors between them, far from everything. */
  const row: SododeckFile = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 300, y: 0 } },
      { id: 'c', type: 'service', title: 'C', position: { x: 600, y: 0 } },
    ],
    edges: [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'bc', from: 'b', to: 'c' },
    ],
  });
  const alt = (x: number, y: number) => pointer(x, y, { altKey: true });
  const copiesOf = (file: SododeckFile) =>
    file.nodes.filter((n) => !['a', 'b', 'c'].includes(n.id));

  it('creates the copy as soon as the drag starts with ⌥: the original stays at its start', () => {
    const { h, doc, editor } = setup(row);
    const paste = vi.spyOn(editor(), 'pasteFragment');
    act(() => {
      h().onNodeDragStart({}, flowNode('a'));
      h().onNodeDrag(alt(100, 100));
      h().onNodesChange(move('a', 40, 900));
    });
    const file = toJSON(doc);
    expect(position(file, 'a')).toEqual({ x: 0, y: 0 });
    const [copy] = copiesOf(file);
    expect(copy).toMatchObject({ title: 'A', position: { x: 40, y: 900 } });
    expect([...ui().dragCopyIds]).toEqual([copy?.id]);
    // More frames move the copy; they never paste again.
    act(() => {
      h().onNodeDrag(alt(120, 120));
      h().onNodesChange(move('a', 80, 960));
      h().onNodesChange(move('a', 90, 970));
    });
    expect(paste).toHaveBeenCalledOnce();
    expect(position(toJSON(doc), 'a')).toEqual({ x: 0, y: 0 });
    expect(copiesOf(toJSON(doc))[0]?.position).toEqual({ x: 90, y: 970 });
    act(() => {
      h().onNodeDragStop(alt(120, 120));
    });
    expect(paste).toHaveBeenCalledOnce();
  });

  it('drops as one undo step, selects and announces the copy', () => {
    const { h, doc, editor } = setup(row);
    act(() => {
      h().onNodeDragStart({}, flowNode('a'));
      h().onNodeDrag(alt(100, 100));
      h().onNodesChange(move('a', 40, 900));
      h().onNodeDragStop(alt(100, 100));
    });
    const file = toJSON(doc);
    const [copy] = copiesOf(file);
    expect(file.nodes).toHaveLength(4);
    expect(ui().selection.nodes).toEqual([copy?.id]);
    expect(ui().announcement.text).toBe('Duplicated 1 component');
    expect(ui().dragCopyIds.size).toBe(0);
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(row);
    expect(editor().canUndo()).toBe(false);
  });

  it.each([
    ['Esc', () => cancelActiveGesture()],
    ['a window blur', () => window.dispatchEvent(new Event('blur'))],
  ])('leaves nothing behind on %s', (_name, cancel) => {
    const { h, doc, editor } = setup(row);
    act(() => {
      h().onNodeDragStart({}, flowNode('a'));
      h().onNodeDrag(alt(100, 100));
      h().onNodesChange(move('a', 40, 900));
    });
    expect(toJSON(doc).nodes).toHaveLength(4);
    act(() => {
      cancel();
    });
    act(() => {
      h().onNodeDragStop(alt(100, 100));
    });
    expect(toJSON(doc)).toEqual(row);
    expect(editor().canUndo()).toBe(false);
    expect(ui().dragCopyIds.size).toBe(0);
  });

  it('switches between move and copy when ⌥ goes down and up mid-drag', () => {
    const { h, doc, editor } = setup(row);
    const paste = vi.spyOn(editor(), 'pasteFragment');
    const remove = vi.spyOn(editor(), 'remove');
    act(() => {
      h().onNodeDragStart({}, flowNode('a'));
      h().onNodeDrag(pointer(100, 100));
      h().onNodesChange(move('a', 40, 900));
    });
    expect(position(toJSON(doc), 'a')).toEqual({ x: 40, y: 900 });
    // ⌥ down: the original snaps back and a copy follows the pointer.
    act(() => {
      h().onNodeDrag(alt(100, 100));
    });
    expect(paste).toHaveBeenCalledOnce();
    expect(position(toJSON(doc), 'a')).toEqual({ x: 0, y: 0 });
    const [copy] = copiesOf(toJSON(doc));
    expect(copy?.position).toEqual({ x: 40, y: 900 });
    // ⌥ up: exactly the copy goes, the original moves again.
    act(() => {
      h().onNodeDrag(pointer(100, 100));
    });
    expect(remove.mock.calls.map(([, id]) => id)).toEqual([copy?.id]);
    expect(toJSON(doc).nodes).toHaveLength(3);
    expect(position(toJSON(doc), 'a')).toEqual({ x: 40, y: 900 });
    expect(ui().dragCopyIds.size).toBe(0);
    act(() => {
      h().onNodesChange(move('a', 50, 950));
      h().onNodeDragStop(pointer(100, 100));
    });
    expect(toJSON(doc).nodes).toHaveLength(3);
    expect(position(toJSON(doc), 'a')).toEqual({ x: 50, y: 950 });
  });

  it('copies every selected card and the connectors between them', () => {
    const { h, doc } = setup(row);
    act(() => {
      ui().select({ nodes: ['a', 'b', 'c'] });
    });
    act(() => {
      h().onNodeDragStart({}, flowNode('b'));
      h().onNodeDrag(alt(100, 100));
      h().onNodesChange(move('b', 300, 900));
    });
    const during = toJSON(doc);
    expect(['a', 'b', 'c'].map((id) => position(during, id))).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 600, y: 0 },
    ]);
    expect(copiesOf(during).map((n) => n.position)).toEqual([
      { x: 0, y: 900 },
      { x: 300, y: 900 },
      { x: 600, y: 900 },
    ]);
    act(() => {
      h().onNodeDragStop(alt(100, 100));
    });
    const file = toJSON(doc);
    expect(file.nodes).toHaveLength(6);
    expect(file.edges).toHaveLength(4);
    expect(ui().announcement.text).toBe('Duplicated 3 components');
  });
});

describe('dragging and duplicating every selected kind', () => {
  /** A group with a card, a loose card, a free note and a note pinned to the loose card. */
  const board: SododeckFile = deckOf({
    nodes: [
      { id: 'in', type: 'service', title: 'In', group: 'g', position: { x: 0, y: 0 } },
      { id: 'out', type: 'service', title: 'Out', position: { x: 600, y: 0 } },
    ],
    groups: [{ id: 'g', title: 'G', ...frame(-40, -40, 320, 200) }],
    stickies: [
      { id: 'n1', text: 'Free', position: { x: 0, y: 600 } },
      { id: 'n2', text: 'Pinned', anchor: 'out', position: { x: 10, y: -80 } },
    ],
    edges: [{ id: 'e', from: 'out', to: 'n1' }],
  });
  const note = (file: SododeckFile, id: string) => file.stickies.find((s) => s.id === id);

  it('moves the group frame when the whole board is selected and a card is dragged', () => {
    const { h, doc, editor } = setup(board);
    act(() => {
      ui().select({ nodes: ['in', 'out'], groups: ['g'], stickies: ['n1', 'n2'] });
    });
    act(() => {
      h().onNodeDragStart({}, flowNode('out'));
      h().onNodesChange(move('out', 700, 50));
      h().onNodeDragStop(pointer(5000, 5000));
    });
    const file = toJSON(doc);
    expect(frameOf(file, 'g')).toEqual(frame(60, 10, 320, 200));
    expect(position(file, 'in')).toEqual({ x: 100, y: 50 });
    expect(position(file, 'out')).toEqual({ x: 700, y: 50 });
    // The free note moves by the delta; the pinned one keeps its offset (it follows its card).
    expect(note(file, 'n1')?.position).toEqual({ x: 100, y: 650 });
    expect(note(file, 'n2')?.position).toEqual({ x: 10, y: -80 });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(board);
  });

  it('drags a note with the controller, so the cards selected with it move too', () => {
    const { h, doc } = setup(board);
    act(() => {
      ui().select({ nodes: ['in'], stickies: ['n1'] });
    });
    act(() => {
      h().onNodeDragStart({}, flowNode('sticky:n1'));
      h().onNodesChange(move('sticky:n1', 130, 750));
      h().onNodeDragStop(pointer(5000, 5000));
    });
    const file = toJSON(doc);
    expect(note(file, 'n1')?.position).toEqual({ x: 130, y: 750 });
    expect(position(file, 'in')).toEqual({ x: 130, y: 150 });
  });

  it('duplicates cards, groups, notes and the connectors between them with ⌥', () => {
    const { h, doc, editor } = setup(board);
    act(() => {
      ui().select({ nodes: ['in', 'out'], groups: ['g'], stickies: ['n1', 'n2'] });
    });
    act(() => {
      h().onNodeDragStart({}, flowNode('sticky:n1'));
      h().onNodeDrag(pointer(0, 0, { altKey: true }));
      h().onNodesChange(move('sticky:n1', 0, 1600));
      h().onNodeDragStop(pointer(0, 0, { altKey: true }));
    });
    const file = toJSON(doc);
    // Originals stay put.
    expect(note(file, 'n1')?.position).toEqual({ x: 0, y: 600 });
    expect(frameOf(file, 'g')).toEqual(frame(-40, -40, 320, 200));
    expect(file.nodes).toHaveLength(4);
    expect(file.groups).toHaveLength(2);
    const copies = file.stickies.filter((s) => !['n1', 'n2'].includes(s.id));
    expect(copies.map((s) => [s.text, s.position, s.anchor])).toEqual([
      ['Free', { x: 0, y: 1600 }, undefined],
      ['Pinned', { x: 610, y: 920 }, undefined],
    ]);
    const copyOfE = file.edges.filter((e) => e.id !== 'e');
    expect(copyOfE).toHaveLength(1);
    expect(copies.map((s) => s.id)).toContain(copyOfE[0]?.to);
    expect(ui().selection.stickies).toEqual(copies.map((s) => s.id));
    expect(ui().selection.groups).toHaveLength(1);
    expect(ui().announcement.text).toBe('Duplicated 2 components and 2 notes');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(board);
  });
});
