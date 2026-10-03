import { analyzeFlow } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { playbackDeck } from '../../test/flow-fixtures';
import {
  currentOf,
  playedPath,
  playerView,
  rehome,
  stepAnnouncement,
  stepForEdge,
  stepForNode,
} from './played-path';

function analysisOf(flowId: string) {
  const flow = playbackDeck.flows.find((f) => f.id === flowId);
  if (flow === undefined) throw new Error(flowId);
  return analyzeFlow(flow, playbackDeck.edges);
}
function at<T>(list: readonly T[], i: number): T {
  const item = list[i];
  if (item === undefined) throw new Error(String(i));
  return item;
}
const ids = (steps: readonly { step: { id: string } }[]) => steps.map((s) => s.step.id);

const order = analysisOf('order');
const fork = analysisOf('fork');

describe('playedPath', () => {
  it('is the main path without branches', () => {
    const played = playedPath(order, null);
    expect(ids(played.steps)).toEqual(['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8']);
    expect(played.alternative).toBeNull();
    expect(played.index.get('o5')).toBe(4);
  });

  it('follows alternative "a" by default, or the chosen one; unknown ids fall back to "a"', () => {
    expect(ids(playedPath(fork, null).steps)).toEqual(['f1', 'f2', 'f3', 'f4a', 'f5a']);
    expect(ids(playedPath(fork, 'failed').steps)).toEqual(['f1', 'f2', 'f3', 'f4b', 'f5b']);
    expect(playedPath(fork, 'nope').alternative?.branch.id).toBe('ok');
  });

  it('resolves the current step, falling back to the first', () => {
    const played = playedPath(order, null);
    expect(currentOf(played, 'o3')?.step.id).toBe('o3');
    expect(currentOf(played, 'gone')?.step.id).toBe('o1');
    expect(currentOf(played, null)?.step.id).toBe('o1');
    expect(currentOf(playedPath(analysisOf('empty'), null), null)).toBeNull();
  });
});

describe('playerView', () => {
  it('labels the position and links previous/next, null at the ends', () => {
    const played = playedPath(order, null);
    expect(playerView(order, played, 'o4')).toMatchObject({
      position: 4,
      total: 8,
      label: 'Step 4 of 8',
      previous: 'o3',
      next: 'o5',
      showPicker: false,
      forkNumber: null,
    });
    expect(playerView(order, played, 'o1')?.previous).toBeNull();
    expect(playerView(order, played, 'o8')?.next).toBeNull();
  });

  it('numbers alternatives and shows the picker from the fork step on', () => {
    const played = playedPath(fork, 'failed');
    expect(playerView(fork, played, 'f4b')).toMatchObject({
      label: 'Step 4b of 5',
      showPicker: true,
      forkNumber: '3',
    });
    expect(playerView(fork, played, 'f3')?.showPicker).toBe(true);
    expect(playerView(fork, played, 'f2')?.showPicker).toBe(false);
  });

  it('fills segments up to the current one and flags error paths and broken steps', () => {
    const view = playerView(fork, playedPath(fork, 'failed'), 'f4b');
    expect(view?.segments.map((s) => [s.number, s.filled, s.current, s.errorPath])).toEqual([
      ['1', true, false, false],
      ['2', true, false, false],
      ['3', true, false, false],
      ['4b', true, true, true],
      ['5b', false, false, true],
    ]);
    const broken = analysisOf('broken');
    expect(playerView(broken, playedPath(broken, null), 'k1')?.segments[1]?.broken).toBe(true);
  });

  it('marks the segment of the next branch point, strictly after the current step (035)', () => {
    const played = playedPath(fork, null);
    const nextFork = (stepId: string) =>
      playerView(fork, played, stepId)?.segments.flatMap((s) => (s.nextFork ? [s.number] : []));
    expect(nextFork('f1')).toEqual(['3']);
    expect(nextFork('f2')).toEqual(['3']);
    // At the fork itself and after it there is no later branch point.
    expect(nextFork('f3')).toEqual([]);
    expect(nextFork('f4a')).toEqual([]);
  });

  it('marks no next fork in a flow without branches', () => {
    const view = playerView(order, playedPath(order, null), 'o1');
    expect(view?.segments.some((s) => s.nextFork)).toBe(false);
  });

  it('is null for an empty flow and tolerates unknown ids', () => {
    const empty = analysisOf('empty');
    expect(playerView(empty, playedPath(empty, null), null)).toBeNull();
    expect(playerView(order, playedPath(order, null), 'gone')?.position).toBe(1);
  });
});

describe('stepForNode / stepForEdge', () => {
  const played = playedPath(order, null);

  it('finds the first step touching a node, null off the path', () => {
    expect(stepForNode(played, 'c')).toBe('o2');
    expect(stepForNode(played, 'n')).toBe('o8');
    expect(stepForNode(played, 'z')).toBeNull();
  });

  it('finds the next step on an edge after the current one, wrapping', () => {
    expect(stepForEdge(played, 'bc', 'o1')).toBe('o2');
    expect(stepForEdge(played, 'bc', 'o2')).toBe('o4');
    expect(stepForEdge(played, 'bc', 'o4')).toBe('o2');
    expect(stepForEdge(played, 'bc', 'gone')).toBe('o2');
    expect(stepForEdge(played, 'az', 'o1')).toBeNull();
  });
});

describe('rehome', () => {
  it('keeps a main-path step, moves to the same position, or the last step when shorter', () => {
    expect(rehome(fork, 'failed', 'f2')).toBe('f2');
    expect(rehome(fork, 'failed', 'f4a')).toBe('f4b');
    expect(rehome(fork, 'ok', 'f5b')).toBe('f5a');
    const shorter = analyzeFlow(
      {
        id: 'short',
        title: 'Short',
        branches: [
          { id: 'p', label: 'p', condition: 'p' },
          { id: 'q', label: 'q', condition: 'q' },
        ],
        steps: [
          { id: 'm1', edge: 'ab' },
          { id: 'p1', edge: 'bc', branch: 'p' },
          { id: 'p2', edge: 'cb', branch: 'p' },
          { id: 'q1', edge: 'bc', branch: 'q' },
        ],
      },
      playbackDeck.edges,
    );
    expect(rehome(shorter, 'q', 'p2')).toBe('q1');
  });

  it('tolerates unknown ids', () => {
    expect(rehome(fork, 'nope', 'f4a')).toBe('f4a');
    expect(rehome(fork, 'failed', 'gone')).toBe('f1');
  });
});

describe('stepAnnouncement', () => {
  it('names the step, its route and its branch', () => {
    const played = playedPath(order, null);
    expect(stepAnnouncement(playbackDeck, played, at(played.steps, 4))).toBe(
      'Step 5 of 8: Order Service → Payment Service',
    );
    const failed = playedPath(fork, 'failed');
    expect(stepAnnouncement(playbackDeck, failed, at(failed.steps, 3))).toBe(
      'Step 4b of 5: Payment Service → Notification Service, branch payment failed',
    );
  });

  it('says when the connection was deleted', () => {
    const broken = analysisOf('broken');
    const played = playedPath(broken, null);
    expect(stepAnnouncement(playbackDeck, played, at(played.steps, 1))).toBe(
      'Step 2 of 3: connection deleted',
    );
  });

  it('adds the collapsed-group title when the current step is hidden inside it', () => {
    const played = playedPath(order, null);
    expect(stepAnnouncement(playbackDeck, played, at(played.steps, 4), 'Core services')).toBe(
      'Step 5 of 8: Order Service → Payment Service, inside Core services',
    );
  });
});
