import { createEditor, fromJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from '../bench/generate-deck';
import { readDeck } from '../model/use-deck-snapshot';
import { EMPTY_SELECTION } from '../state/ui-store';
import { toFlowEdges, toFlowNodes, type CanvasView } from './deck-to-flow';
import { viewStateOf } from './views/view-state';
import { visibleGraph } from './visible-graph';

/** SC-006 / T035: collapsing or expanding a 50-table schema takes at most 1 s. */
const BUDGET_MS = 1000;

const canvas: CanvasView = {
  selection: EMPTY_SELECTION,
  focusedId: null,
  focusedEdgeId: null,
  labelsOn: false,
  level: 'component',
  focus: null,
  marks: { merged: new Map(), cards: new Map(), cardNumbers: new Map() },
};

const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0;

describe('collapsing a 50-table schema (048 T035)', () => {
  const { deck } = generateBenchDeck(150, 250, 42, { tables: 150, rel: true, schemas: 3 });
  const doc = fromJSON({ ...deck, groupingMode: 'schema' });
  const editor = createEditor(doc);

  /** One user action: the write, then everything the canvas derives from it (no DOM paint). */
  function derive(): { nodes: number; edges: number } {
    const state = viewStateOf(readDeck(doc), null);
    const graph = visibleGraph(state.deck, { node: null, group: null }, state.collapsed);
    const view = { ...canvas, render: state.render };
    return {
      nodes: toFlowNodes(state.deck, graph, view).length,
      edges: toFlowEdges(state.deck, graph, view).length,
    };
  }

  it('uses 3 schemas of 50 tables', () => {
    const state = viewStateOf(readDeck(doc), null);
    expect(state.deck.groups.map((g) => g.id)).toEqual([
      'schema:schema_0',
      'schema:schema_1',
      'schema:schema_2',
    ]);
    expect(state.deck.nodes.filter((n) => n.group === 'schema:schema_0')).toHaveLength(50);
  });

  it(`collapses and expands in under ${String(BUDGET_MS)} ms`, () => {
    const viewId = viewStateOf(readDeck(doc), null).view.id;
    const full = derive();
    const collapse: number[] = [];
    const expand: number[] = [];
    for (let run = 0; run < 5; run++) {
      let start = performance.now();
      editor.setCollapsed(viewId, 'schema:schema_0', true);
      const folded = derive();
      collapse.push(performance.now() - start);
      expect(folded.nodes).toBeLessThan(full.nodes);
      start = performance.now();
      editor.setCollapsed(viewId, 'schema:schema_0', false);
      derive();
      expand.push(performance.now() - start);
    }
    console.info(
      `collapse median ${median(collapse).toFixed(1)} ms, expand median ${median(expand).toFixed(1)} ms`,
    );
    expect(median(collapse)).toBeLessThan(BUDGET_MS);
    expect(median(expand)).toBeLessThan(BUDGET_MS);
  });
});
