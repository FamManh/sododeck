import { analyzeFlow } from '@sododeck/model';
import type { Flow } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  branchedDeck,
  branchedFlow,
  flowDeck,
  playbackDeck,
  session,
} from '../../test/flow-fixtures';
import { deckOf } from '../../test/render-canvas';
import { flowOverlay } from './flow-overlay';

const place = flowDeck.flows[0] as Flow;
const analysisOf = (flow: Flow) => analyzeFlow(flow, flowDeck.edges);

describe('flowOverlay', () => {
  it('marks a selected flow: numbered badges on a solid path, nothing else', () => {
    const overlay = flowOverlay(flowDeck, analysisOf(place), null, null, 's2');
    expect(overlay.edges.get('ab')).toEqual({
      badges: [{ label: '1', errorPath: false, current: false, chainBreak: false }],
      style: 'path',
      errorIcon: false,
    });
    expect(overlay.edges.get('bc')?.badges[0]?.current).toBe(true);
    expect(overlay.edges.size).toBe(2);
    expect(overlay.nodes.size).toBe(0);
  });

  it('marks an error branch dashed with its icon', () => {
    const overlay = flowOverlay(branchedDeck, analysisOf(branchedFlow), null, null);
    expect(overlay.edges.get('cx')).toMatchObject({
      style: 'error',
      errorIcon: true,
      badges: [{ label: '3b', errorPath: true }],
    });
    expect(overlay.edges.get('cd')).toMatchObject({ style: 'path', badges: [{ label: '3a' }] });
  });

  it('gives an edge used twice two badges', () => {
    const loop: Flow = {
      id: 'l',
      title: 'L',
      steps: [
        { id: '1', edge: 'ab' },
        { id: '2', edge: 'bb' },
        { id: '3', edge: 'bb' },
      ],
    };
    expect(flowOverlay(flowDeck, analysisOf(loop), null, null).edges.get('bb')?.badges).toEqual([
      expect.objectContaining({ label: '2' }),
      expect.objectContaining({ label: '3' }),
    ]);
  });

  it('draws no mark for a broken step', () => {
    const broken: Flow = { id: 'x', title: 'X', steps: [{ id: '1', edge: 'gone' }] };
    expect(flowOverlay(flowDeck, analysisOf(broken), null, null).edges.size).toBe(0);
  });

  it('while recording: ring on the next start node and dotted candidates', () => {
    const overlay = flowOverlay(flowDeck, analysisOf(place), session({ flowId: 'place' }), null);
    expect(overlay.nodes.get('c')).toEqual({ startsHere: 'Step 3 starts here' });
    expect(overlay.edges.get('cd')?.style).toBe('candidate');
    expect(overlay.edges.get('cx')?.style).toBe('candidate');
    expect(overlay.edges.has('ab')).toBe(true);
    expect(overlay.edges.get('ab')?.style).toBe('path');
  });

  it('previews the hovered edge when it continues the chain, not otherwise', () => {
    const s = session({ flowId: 'place' });
    expect(flowOverlay(flowDeck, analysisOf(place), s, 'cd').edges.get('cd')?.style).toBe(
      'preview',
    );
    expect(flowOverlay(flowDeck, analysisOf(place), s, 'ab').edges.get('ab')?.style).toBe('path');
    // Before the first step, any edge previews as step 1.
    expect(flowOverlay(flowDeck, null, session(), 'cy').edges.get('cy')?.style).toBe('preview');
  });

  it('shows the refused edge in the invalid style', () => {
    const s = session({
      flowId: 'place',
      invalid: { edgeId: 'ab', stepNumber: '3', branchFromStep: null },
    });
    expect(flowOverlay(flowDeck, analysisOf(place), s, null).edges.get('ab')).toMatchObject({
      style: 'invalid',
      badges: [{ label: '1' }],
    });
  });

  it('targets the branch being recorded', () => {
    const s = session({ flowId: 'pay', target: { kind: 'branch', branchId: 'fail' } });
    const overlay = flowOverlay(branchedDeck, analysisOf(branchedFlow), s, null);
    expect(overlay.nodes.get('x')).toEqual({ startsHere: 'Step 4b starts here' });
  });
});

describe('flowOverlay in flow mode (007)', () => {
  const fork = playbackDeck.flows.find((f) => f.id === 'fork') as Flow;
  const forkAnalysis = analyzeFlow(fork, playbackDeck.edges);
  const playback = (stepId: string, speed: 1 | 2 = 1) => ({
    played: new Set(['f1', 'f2', 'f3', 'f4a', 'f5a']),
    currentStepId: stepId,
    speed,
  });

  it('marks played edges and nodes, the current edge and its target card', () => {
    const overlay = flowOverlay(playbackDeck, forkAnalysis, null, null, 'f2', playback('f2', 2));
    expect(overlay.edges.get('bc')).toMatchObject({
      inPath: true,
      state: 'current',
      current: { speed: 2, number: '2' },
    });
    expect(overlay.edges.get('ab')).toMatchObject({ inPath: true, state: 'played', current: null });
    expect(overlay.nodes.get('c')).toEqual({
      inPath: true,
      currentStep: true,
      step: { state: 'current', number: '2' },
    });
    // The source of the current step is played, not current (035 clarification).
    expect(overlay.nodes.get('b')).toEqual({
      inPath: true,
      currentStep: false,
      step: { state: 'played', number: null },
    });
    expect(overlay.nodes.get('a')).toMatchObject({ currentStep: false, step: { state: 'played' } });
  });

  it('gives later steps upcoming edges and cards, numbered by their first step', () => {
    const overlay = flowOverlay(playbackDeck, forkAnalysis, null, null, 'f1', playback('f1'));
    expect(overlay.edges.get('bc')).toMatchObject({ state: 'upcoming', current: null });
    expect(overlay.nodes.get('c')?.step).toEqual({ state: 'upcoming', number: '2' });
    expect(overlay.nodes.get('b')?.step).toEqual({ state: 'current', number: '1' });
  });

  it('removes the other alternative from the marks when the branch switches (035)', () => {
    const ok = flowOverlay(playbackDeck, forkAnalysis, null, null, 'f4a', playback('f4a'));
    expect(ok.nodes.get('d')?.step).toEqual({ state: 'upcoming', number: '5a' });
    expect(ok.edges.get('cd')).toMatchObject({ inPath: true, state: 'upcoming' });
    expect(ok.edges.get('xn')).toMatchObject({ inPath: false });
    const failed = {
      played: new Set(['f1', 'f2', 'f3', 'f4b', 'f5b']),
      currentStepId: 'f4b',
      speed: 1 as const,
    };
    const other = flowOverlay(playbackDeck, forkAnalysis, null, null, 'f4b', failed);
    // No sticker, no path mark on the alternative that is no longer played: it dims.
    expect(other.nodes.has('d')).toBe(false);
    expect(other.edges.get('cd')).toMatchObject({ inPath: false, current: null });
    expect(other.edges.get('cd')?.state).toBeUndefined();
  });

  it('gives an error-path target the normal sticker, and its connector the error style (FR-013)', () => {
    const failed = {
      played: new Set(['f1', 'f2', 'f3', 'f4b', 'f5b']),
      currentStepId: 'f4b',
      speed: 1 as const,
    };
    const overlay = flowOverlay(playbackDeck, forkAnalysis, null, null, 'f4b', failed);
    expect(overlay.nodes.get('n')).toEqual({
      inPath: true,
      currentStep: true,
      step: { state: 'current', number: '4b' },
    });
    expect(overlay.nodes.get('x')?.step).toEqual({ state: 'played', number: null });
    expect(overlay.edges.get('xn')).toMatchObject({
      style: 'error',
      state: 'current',
      current: { number: '4b' },
    });
  });

  it('shows the most advanced state on an edge several steps travel', () => {
    const order = playbackDeck.flows.find((f) => f.id === 'order') as Flow;
    const analysis = analyzeFlow(order, playbackDeck.edges);
    const played = new Set(order.steps.map((s) => s.id));
    // bc is step 2 (played) and step 4 (upcoming) while step 3 is current.
    const overlay = flowOverlay(playbackDeck, analysis, null, null, 'o3', {
      played,
      currentStepId: 'o3',
      speed: 1,
    });
    expect(overlay.edges.get('bc')?.state).toBe('played');
    expect(overlay.edges.get('cb')).toMatchObject({ state: 'current', current: { number: '3' } });
    expect(overlay.edges.get('cx')?.state).toBe('upcoming');
  });

  it('keeps badges on the other alternative, outside the path', () => {
    const overlay = flowOverlay(playbackDeck, forkAnalysis, null, null, 'f2', playback('f2'));
    expect(overlay.edges.get('xn')).toMatchObject({
      inPath: false,
      current: null,
      badges: [{ label: '4b', errorPath: true }],
    });
    expect(overlay.nodes.has('n')).toBe(false);
  });

  it('marks nothing for a broken step', () => {
    const broken = playbackDeck.flows.find((f) => f.id === 'broken') as Flow;
    const overlay = flowOverlay(
      playbackDeck,
      analyzeFlow(broken, playbackDeck.edges),
      null,
      null,
      'k2',
      { played: new Set(['k1', 'k2', 'k3']), currentStepId: 'k2', speed: 1 },
    );
    expect(overlay.edges.has('gone')).toBe(false);
    expect([...overlay.edges.values()].some((m) => m.current !== null)).toBe(false);
    expect([...overlay.nodes.values()].some((m) => m.currentStep === true)).toBe(false);
  });

  it('gives exactly the 006 marks without playback', () => {
    const overlay = flowOverlay(playbackDeck, forkAnalysis, null, null, 'f2', null);
    expect(overlay.edges.get('bc')).toEqual({
      badges: [{ label: '2', errorPath: false, current: true, chainBreak: false }],
      style: 'path',
      errorIcon: false,
    });
    expect(overlay.nodes.size).toBe(0);
  });
});

describe('flow overlay: step touches (049 US3)', () => {
  const deck = deckOf({
    nodes: [
      { id: 'web', type: 'client', title: 'Web' },
      { id: 'svc', type: 'service', title: 'Orders' },
      { id: 'odb', type: 'database', title: 'Orders DB' },
      { id: 'cdb', type: 'database', title: 'Customers DB' },
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        parent: 'odb',
        columns: [{ id: 'o-total', name: 'total', type: 'int' }],
      },
      { id: 'items', type: 'db-table', title: 'items', parent: 'odb', columns: [] },
      {
        id: 'customers',
        type: 'db-table',
        title: 'customers',
        parent: 'cdb',
        columns: [{ id: 'c-email', name: 'email', type: 'text' }],
      },
    ],
    edges: [
      { id: 'e1', from: 'web', to: 'svc' },
      { id: 'e2', from: 'svc', to: 'odb' },
    ],
    flows: [
      {
        id: 'f',
        title: 'Checkout',
        steps: [
          { id: 's1', edge: 'e1' },
          {
            id: 's2',
            edge: 'e2',
            touches: [
              { table: 'orders', access: 'write' },
              { table: 'orders', column: 'o-total', access: 'write' },
              { table: 'items', access: 'read' },
              { table: 'customers', column: 'c-email', access: 'read' },
            ],
          },
        ],
      },
    ],
  });
  const flow = deck.flows[0];
  if (flow === undefined) throw new Error('flow');
  const analysis = analyzeFlow(flow, deck.edges);
  const at = (stepId: string) =>
    flowOverlay(deck, analysis, null, null, stepId, {
      played: new Set(['s1', 's2']),
      currentStepId: stepId,
      speed: 1,
    });

  it('lights touched tables with their access and touched columns', () => {
    const nodes = at('s2').nodes;
    expect(nodes.get('orders')).toMatchObject({
      inPath: true,
      currentStep: true,
      touch: 'write',
      step: { state: 'current', number: '2' },
    });
    expect([...(nodes.get('orders')?.columns ?? [])]).toEqual([['o-total', 'write']]);
    expect(nodes.get('items')).toMatchObject({ touch: 'read' });
    expect(nodes.get('customers')?.columns?.get('c-email')).toBe('read');
  });

  it('gives each database card its chip, verb first', () => {
    const nodes = at('s2').nodes;
    expect(nodes.get('odb')?.chip?.text).toBe('writes orders +1');
    expect(nodes.get('odb')?.inPath).toBe(true);
    expect(nodes.get('cdb')?.chip?.text).toBe('reads customers');
  });

  it('marks nothing for a step without touches', () => {
    const nodes = at('s1').nodes;
    expect(nodes.get('orders')).toBeUndefined();
    expect(nodes.get('odb')?.chip).toBeUndefined();
  });
});
