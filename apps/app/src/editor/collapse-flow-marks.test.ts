import { describe, expect, it } from 'vitest';

import type { FlowOverlay } from './flows/flow-overlay';
import type { PlayedPath } from './flows/played-path';
import { EMPTY_OVERLAY } from './flows/flow-overlay';
import { collapseFlowMarks, groupAtStep, stepForEdges, stepForGroup } from './collapse-flow-marks';
import { visibleGraph } from './visible-graph';
import { deckOf } from '../test/render-canvas';

const overlay: FlowOverlay = {
  edges: new Map([
    [
      'ac',
      {
        badges: [{ label: '1', errorPath: false, current: false, chainBreak: false }],
        style: 'path',
        errorIcon: false,
        inPath: true,
      },
    ],
    [
      'bc',
      {
        badges: [{ label: '2', errorPath: false, current: true, chainBreak: false }],
        style: 'path',
        errorIcon: false,
        inPath: true,
        current: { speed: 2 },
      },
    ],
    [
      'ab',
      {
        badges: [{ label: '0', errorPath: false, current: false, chainBreak: false }],
        style: 'path',
        errorIcon: false,
        inPath: true,
      },
    ],
  ]),
  nodes: new Map(),
};

describe('collapseFlowMarks', () => {
  const deck = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', group: 'core' },
      { id: 'b', type: 'service', title: 'B', group: 'core' },
      { id: 'c', type: 'service', title: 'C' },
    ],
    groups: [{ id: 'core', title: 'Core services' }],
    edges: [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'ac', from: 'a', to: 'c' },
      { id: 'bc', from: 'b', to: 'c' },
    ],
  });
  const graph = visibleGraph(deck, { node: null, group: null }, new Set(['core']));

  it('folds merged-edge badges and card states', () => {
    const marks = collapseFlowMarks(overlay, graph);
    expect(marks.merged.get('merged:c|collapsed:core')).toMatchObject({
      badges: [
        { label: '1', current: false },
        { label: '2', current: true },
      ],
      inPath: true,
      current: { speed: 2 },
    });
    expect(marks.cards.get('core')).toBe('path');
  });

  it('returns the outer collapsed group title for a hidden edge', () => {
    expect(groupAtStep(deck, graph, 'ab')).toBe('Core services');
    expect(groupAtStep(deck, graph, 'ac')).toBeNull();
  });

  it('finds the first played step in a collapsed group and cycles merged-edge steps', () => {
    const played: PlayedPath = {
      steps: [
        {
          step: { id: 's1', edge: 'ac' },
          number: '1',
          from: 'a',
          to: 'c',
          branchId: null,
          broken: false,
          chainBreak: false,
        },
        {
          step: { id: 's2', edge: 'ab' },
          number: '2',
          from: 'a',
          to: 'b',
          branchId: null,
          broken: false,
          chainBreak: false,
        },
        {
          step: { id: 's3', edge: 'bc' },
          number: '3',
          from: 'b',
          to: 'c',
          branchId: null,
          broken: false,
          chainBreak: false,
        },
      ],
      alternative: null,
      index: new Map([
        ['s1', 0],
        ['s2', 1],
        ['s3', 2],
      ]),
    };
    expect(stepForGroup(played, graph, 'core')).toBe('s2');
    expect(stepForEdges(played, ['ac', 'bc'], 's1')).toBe('s3');
    expect(stepForEdges(played, ['ac', 'bc'], 's3')).toBe('s1');
    expect(stepForEdges(played, ['missing'], 's1')).toBeNull();
  });

  it('returns empty maps for EMPTY_OVERLAY', () => {
    const marks = collapseFlowMarks(EMPTY_OVERLAY, graph);
    expect(marks.merged.size).toBe(0);
    expect(marks.cards.size).toBe(0);
  });
});
