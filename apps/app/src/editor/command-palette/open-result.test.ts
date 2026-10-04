import { type DeckEditor } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NODE_SIZE, tableLayoutOf } from '../canvas-geometry';
import { readViewState } from '../views/use-current-view';
import { toJSON } from '@sododeck/model';
import { openFlow as openFlowAction } from '../flows/flow-mode';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import type { Selection } from '../../state/ui-store';
import { useUiStore } from '../../state/ui-store';
import type { PaletteResult } from './palette-results';
import { edgeCenter, openResult } from './open-result';

function fixtureDeck(): SododeckFile {
  const deck = emptySododeckFile();
  deck.nodes.push(
    { id: 'a', type: 'service', title: 'A', position: { x: 40, y: 60 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 240, y: 160 } },
  );
  deck.edges.push({ id: 'ab', from: 'a', to: 'b', label: 'A → B' });
  deck.flows.push({
    id: 'flow-1',
    title: 'Place order',
    steps: [
      { id: 'step-1', edge: 'ab' },
      { id: 'step-2', edge: 'ab', title: 'Authorize payment' },
    ],
  });
  deck.rules['rule-1'] = {
    title: 'Reattempt policy',
    hitPolicy: 'first',
    inputs: [],
    outputs: [],
    rows: [],
  };
  deck.stickies.push({ id: 'note-1', text: 'Retry note', position: { x: 320, y: 72 } });
  return deck;
}

function context(deck: SododeckFile, editor: DeckEditor, screen: 'canvas' | 'rules' = 'canvas') {
  return {
    deck,
    editor,
    screen,
    announce: vi.fn(),
    openRules: vi.fn(),
    navigateToCanvas: vi.fn(),
    fitView: vi.fn(),
    setCenter: vi.fn(),
    getZoom: vi.fn(() => 0.75),
    select: vi.fn<(selection: Partial<Selection>) => void>((selection) => {
      useUiStore.getState().select(selection);
    }),
    focus: vi.fn((id: string | null) => {
      useUiStore.getState().focus(id);
    }),
    exitFlow: vi.fn(() => {
      useUiStore.getState().exitFlow();
    }),
    openFlow: vi.fn((deckEditor: DeckEditor, flowId: string, stepId?: string | null) => {
      openFlowAction(deckEditor, flowId, stepId);
    }),
  };
}

function result(
  kind: PaletteResult['kind'],
  id: string,
  extra: Partial<PaletteResult> = {},
): PaletteResult {
  return {
    kind,
    id,
    title: id,
    meta: '',
    titleRanges: [],
    ...extra,
  };
}

describe('openResult', () => {
  it('selects and focuses a node, then fits it into view', () => {
    const deck = fixtureDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());

    const opened = openResult(result('node', 'a'), ctx);

    expect(opened).toBe(true);
    expect(useUiStore.getState().selection.nodes).toEqual(['a']);
    expect(useUiStore.getState().focusedId).toBe('a');
    expect(ctx.fitView).toHaveBeenCalledWith({
      nodes: [{ id: 'a' }],
      duration: 0,
      maxZoom: 1,
    });
  });

  it('selects an edge and centres its midpoint', () => {
    const deck = fixtureDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());

    const opened = openResult(result('edge', 'ab'), ctx);

    expect(opened).toBe(true);
    expect(useUiStore.getState().selection.edges).toEqual(['ab']);
    expect(ctx.setCenter).toHaveBeenCalledWith(
      (40 + 240 + NODE_SIZE.width) / 2,
      (60 + 160 + NODE_SIZE.height) / 2,
      { zoom: 0.75 },
    );
  });

  it('selects a note and centres it', () => {
    const deck = fixtureDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());

    const opened = openResult(result('sticky', 'note-1'), ctx);

    expect(opened).toBe(true);
    expect(useUiStore.getState().selection.stickies).toEqual(['note-1']);
    expect(ctx.setCenter).toHaveBeenCalledWith(320, 72, { zoom: 0.75 });
  });

  it('opens flows at the requested step', () => {
    const deck = fixtureDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());

    expect(openResult(result('flow', 'flow-1'), ctx)).toBe(true);
    expect(useUiStore.getState().activeFlow).toMatchObject({ flowId: 'flow-1', stepId: 'step-1' });

    act(() => {
      useUiStore.getState().exitFlow();
    });

    expect(openResult(result('step', 'step-2', { flowId: 'flow-1' }), ctx)).toBe(true);
    expect(useUiStore.getState().activeFlow).toMatchObject({ flowId: 'flow-1', stepId: 'step-2' });
  });

  it('exits flow mode before selecting canvas targets', () => {
    const deck = fixtureDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());
    const calls: string[] = [];
    ctx.exitFlow.mockImplementation(() => {
      calls.push('exit');
      useUiStore.getState().exitFlow();
    });
    ctx.select.mockImplementation((selection: Partial<Selection>) => {
      calls.push('select');
      useUiStore.getState().select(selection);
    });

    act(() => {
      openFlowAction(env.editor(), 'flow-1');
    });

    expect(openResult(result('node', 'a'), ctx)).toBe(true);
    expect(calls).toEqual(['exit', 'select']);
  });

  it('opens the rule editor, and canvas targets navigate to the canvas from the rules screen', () => {
    const deck = fixtureDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const rulesCtx = context(deck, env.editor(), 'rules');
    const order: string[] = [];
    rulesCtx.navigateToCanvas.mockImplementation(() => {
      order.push('navigate');
    });
    rulesCtx.select.mockImplementation((selection: Partial<Selection>) => {
      order.push('select');
      useUiStore.getState().select(selection);
    });

    expect(openResult(result('rule', 'rule-1'), rulesCtx)).toBe(true);
    expect(rulesCtx.openRules).toHaveBeenCalledWith('rule-1');

    expect(openResult(result('edge', 'ab'), rulesCtx)).toBe(true);
    expect(order).toEqual(['navigate', 'select']);
  });

  it('announces when the target no longer exists and returns false', () => {
    const deck = fixtureDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());

    expect(openResult(result('node', 'gone'), ctx)).toBe(false);
    expect(ctx.announce).toHaveBeenCalledWith('This item no longer exists');
  });
});

describe('edgeCenter group ends (050 US4)', () => {
  it("uses a group end's frame centre", () => {
    const deck = deckOf({
      nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } }],
      groups: [
        { id: 'g', title: 'G', position: { x: 400, y: 0 }, size: { width: 200, height: 100 } },
      ],
      edges: [{ id: 'ag', from: 'a', to: 'g' }],
    });
    const centre = edgeCenter(deck, 'a', 'g', 1);
    expect(centre).not.toBeNull();
    // A's centre is left of 400; the frame's is (500, 50).
    expect(centre?.x).toBeGreaterThan(250);
    expect(centre?.x).toBeLessThan(500);
    expect(edgeCenter(deck, 'a', 'missing', 1)).toBeNull();
  });
});

describe('table and column results (048 FR-021, FR-022)', () => {
  function tablesDeck(locked = false): SododeckFile {
    const deck = emptySododeckFile();
    deck.nodes.push(
      {
        id: 't',
        type: 'db-table',
        title: 'events',
        position: { x: 100, y: 200 },
        ...(locked ? { locked: true } : {}),
        columns: Array.from({ length: 60 }, (_, i) => ({
          id: `c${String(i + 1)}`,
          name: `col_${String(i + 1)}`,
          type: 'int',
        })),
      },
      { id: 'u', type: 'db-table', title: 'users', position: { x: 900, y: 0 }, columns: [] },
    );
    return deck;
  }
  const column = (id: string) => result('column', id, { tableId: 't', title: `events.${id}` });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const frames = () => {
    vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
      run(0);
      return 0;
    });
  };

  it('opens a table like a card: select, focus, fit', () => {
    const deck = tablesDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());
    expect(openResult(result('table', 'u'), ctx)).toBe(true);
    expect(useUiStore.getState().selection.nodes).toEqual(['u']);
    expect(ctx.fitView).toHaveBeenCalled();
  });

  it('opens a cut table as Show all (one undo step), selects the row and centres it', () => {
    frames();
    const deck = tablesDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());
    ctx.getZoom.mockReturnValue(0.4);
    expect(openResult(column('c50'), ctx)).toBe(true);
    expect(toJSON(env.doc).nodes[0]?.expanded).toBe(true);
    expect(useUiStore.getState().selection.nodes).toEqual(['t']);
    expect(useUiStore.getState().focusedRow).toEqual({ tableId: 't', columnId: 'c50' });
    const layout = tableLayoutOf(readViewState(env.doc).deck.nodes[0] ?? { title: '' });
    expect(layout.rows).toHaveLength(60);
    expect(ctx.setCenter).toHaveBeenCalledWith(
      100 + layout.width / 2,
      200 + layout.rowsTop + 49 * 24 + 12,
      // System level draws no rows: the pan zooms in to show it.
      { zoom: 1 },
    );
    act(() => {
      env.editor().undo();
    });
    expect(toJSON(env.doc).nodes[0]?.expanded).toBeUndefined();
    expect(env.editor().canUndo()).toBe(false);
  });

  it('keeps the zoom when rows are drawn, and writes nothing for a visible row', () => {
    frames();
    const deck = tablesDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());
    ctx.getZoom.mockReturnValue(1.5);
    expect(openResult(column('c3'), ctx)).toBe(true);
    expect(toJSON(env.doc).nodes[0]?.expanded).toBeUndefined();
    expect(env.editor().canUndo()).toBe(false);
    expect(ctx.setCenter).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), {
      zoom: 1.5,
    });
  });

  it('opens a cut column of a locked table too', () => {
    frames();
    const deck = tablesDeck(true);
    const env = renderWithEditor(null, deckOf(deck));
    expect(openResult(column('c50'), context(deck, env.editor()))).toBe(true);
    expect(toJSON(env.doc).nodes[0]?.expanded).toBe(true);
  });

  it('offers "Show in view" for a table hidden in this view and changes nothing', () => {
    frames();
    const deck = tablesDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const showToast = vi.fn();
    const ctx = {
      ...context(deck, env.editor()),
      isHidden: () => true,
      firstViewShowing: () => ({ id: 'v2', title: 'Billing' }),
      showToast,
    };
    expect(openResult(column('c50'), ctx)).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.mock.calls[0]?.[0]).toBe('events is hidden in this view');
    expect(showToast.mock.calls[0]?.[1]).toMatchObject({ label: 'Show in Billing' });
    expect(toJSON(env.doc).nodes[0]?.expanded).toBeUndefined();
    expect(useUiStore.getState().selection.nodes).toEqual([]);
    expect(ctx.setCenter).not.toHaveBeenCalled();
  });

  it('offers "Expand schema" for a table in a collapsed schema group, then opens it (048)', () => {
    frames();
    const deck = tablesDeck();
    const env = renderWithEditor(null, deckOf(deck));
    env.editor().setCollapsed('system', 'schema:billing', true);
    const showToast = vi.fn();
    const ctx = {
      ...context(deck, env.editor()),
      collapsedSchemaOf: () =>
        readViewState(env.doc).collapsed.has('schema:billing')
          ? { groupId: 'schema:billing', title: 'billing' }
          : null,
      showToast,
    };
    expect(openResult(column('c50'), ctx)).toBe(true);
    expect(showToast.mock.calls[0]?.[0]).toBe('events is in the collapsed schema billing');
    expect(showToast.mock.calls[0]?.[1]).toMatchObject({ label: 'Expand schema' });
    expect(useUiStore.getState().selection.nodes).toEqual([]);
    const action = showToast.mock.calls[0]?.[1] as { onAction: () => void };
    act(() => {
      action.onAction();
    });
    expect(toJSON(env.doc).views.find((v) => v.id === 'system')?.collapsed).toBeUndefined();
    expect(useUiStore.getState().selection.nodes).toEqual(['t']);
  });

  it('says so when the table or the column is gone', () => {
    const deck = tablesDeck();
    const env = renderWithEditor(null, deckOf(deck));
    const ctx = context(deck, env.editor());
    expect(openResult(result('column', 'nope', { tableId: 't' }), ctx)).toBe(false);
    expect(openResult(result('column', 'c1', { tableId: 'gone' }), ctx)).toBe(false);
    expect(ctx.announce).toHaveBeenCalledWith('This item no longer exists');
  });
});
