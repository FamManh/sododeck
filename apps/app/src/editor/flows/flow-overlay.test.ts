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

  it('marks played edges and nodes, the current edge and its nodes', () => {
    const overlay = flowOverlay(playbackDeck, forkAnalysis, null, null, 'f2', playback('f2', 2));
    expect(overlay.edges.get('bc')).toMatchObject({ inPath: true, current: { speed: 2 } });
    expect(overlay.edges.get('ab')).toMatchObject({ inPath: true, current: null });
    expect(overlay.nodes.get('b')).toEqual({ inPath: true, currentStep: true });
    expect(overlay.nodes.get('c')).toEqual({ inPath: true, currentStep: true });
    expect(overlay.nodes.get('a')).toEqual({ inPath: true, currentStep: false });
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
