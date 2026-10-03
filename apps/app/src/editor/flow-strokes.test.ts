import { describe, expect, it } from 'vitest';

import { FLOW_STROKES, flowStrokeKey } from './flow-strokes';
import type { EdgeFlowMark } from './flows/flow-overlay';

describe('FLOW_STROKES (035 FR-009)', () => {
  it('played is Secondary at 2.5px, solid', () => {
    expect(FLOW_STROKES.played).toEqual({ stroke: 'var(--color-ink-secondary)', width: 2.5 });
  });

  it('current is Deck Orange at 3.25px, solid', () => {
    expect(FLOW_STROKES.current).toEqual({ stroke: 'var(--color-deck-orange)', width: 3.25 });
  });

  it('upcoming is dashed "2 6" with round caps', () => {
    expect(FLOW_STROKES.upcoming).toMatchObject({ dash: '2 6', cap: 'round' });
  });

  it('error is Clay at 2.5px, dashed "7 4"', () => {
    expect(FLOW_STROKES.error).toEqual({
      stroke: 'var(--color-clay-ink)',
      width: 2.5,
      dash: '7 4',
    });
  });

  it('keeps the recording styles', () => {
    expect(FLOW_STROKES.path).toEqual({ stroke: 'var(--color-primary)', width: 2 });
    expect(FLOW_STROKES.candidate).toMatchObject({ width: 1.5, dash: '2 4' });
    expect(FLOW_STROKES.preview).toMatchObject({ width: 2.5, dash: '2 4' });
    expect(FLOW_STROKES.invalid).toMatchObject({ stroke: 'var(--color-clay-ink)', dash: '6 4' });
  });
});

describe('flowStrokeKey', () => {
  const mark = (patch: Partial<EdgeFlowMark>): EdgeFlowMark => ({
    badges: [],
    style: 'path',
    errorIcon: false,
    ...patch,
  });

  it('follows the playback state in flow mode', () => {
    expect(flowStrokeKey(mark({ inPath: true, state: 'played' }))).toBe('played');
    expect(flowStrokeKey(mark({ inPath: true, state: 'current' }))).toBe('current');
    expect(flowStrokeKey(mark({ inPath: true, state: 'upcoming' }))).toBe('upcoming');
  });

  it('lets an error path keep its Clay dashes in every state', () => {
    expect(flowStrokeKey(mark({ style: 'error', inPath: true, state: 'played' }))).toBe('error');
    expect(flowStrokeKey(mark({ style: 'error', inPath: true, state: 'current' }))).toBe('error');
  });

  it('uses the recording style outside flow mode and off the played path', () => {
    expect(flowStrokeKey(mark({}))).toBe('path');
    expect(flowStrokeKey(mark({ style: 'candidate' }))).toBe('candidate');
    expect(flowStrokeKey(mark({ inPath: false }))).toBe('path');
  });
});
