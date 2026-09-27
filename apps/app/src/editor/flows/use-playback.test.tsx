import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { playbackDeck } from '../../test/flow-fixtures';
import { announced, renderFlows } from '../../test/render-flows';
import { exitFlow, openFlow, play, switchAlternative } from './flow-mode';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(flowId = 'order', stepId: string | null = null) {
  const view = renderFlows(playbackDeck);
  act(() => {
    openFlow(view.editor(), flowId, stepId);
  });
  const start = () => {
    act(() => {
      play(view.editor());
    });
  };
  return { ...view, start };
}

const tick = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('usePlayback', () => {
  it('advances every 1700 ms at 1× with one pending timeout, announcing each step', () => {
    const { start, ui } = setup();
    start();
    expect(vi.getTimerCount()).toBe(1);
    tick(1699);
    expect(ui().activeFlow?.stepId).toBe('o1');
    tick(1);
    expect(ui().activeFlow?.stepId).toBe('o2');
    expect(announced()).toBe('Step 2 of 8: API Gateway → Order Service');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('advances every 850 ms at 2×', () => {
    const { start, ui } = setup();
    act(() => {
      ui().setSpeed(2);
    });
    start();
    tick(850);
    expect(ui().activeFlow?.stepId).toBe('o2');
    tick(850);
    expect(ui().activeFlow?.stepId).toBe('o3');
  });

  it('stops on the last step; Play there restarts at step 1', () => {
    const { start, ui } = setup('order', 'o7');
    start();
    tick(1700);
    expect(ui().activeFlow).toMatchObject({ stepId: 'o8', playing: false });
    expect(vi.getTimerCount()).toBe(0);
    start();
    expect(ui().activeFlow).toMatchObject({ stepId: 'o1', playing: true });
  });

  it('pauses when the tab is hidden', () => {
    const { start, ui } = setup();
    start();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => {
      fireEvent(document, new Event('visibilitychange'));
    });
    hidden.mockRestore();
    expect(ui().activeFlow?.playing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer behind after exit or unmount, however often it runs', () => {
    const { editor, ui, unmount } = setup();
    for (let i = 0; i < 30; i += 1) {
      act(() => {
        openFlow(editor(), i % 2 === 0 ? 'order' : 'fork');
        play(editor());
      });
      tick(i % 3 === 0 ? 1700 : 10);
      act(() => {
        exitFlow();
      });
      expect(vi.getTimerCount()).toBe(0);
    }
    act(() => {
      openFlow(editor(), 'order');
      play(editor());
    });
    expect(ui().activeFlow?.playing).toBe(true);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('continues from the fork into the chosen alternative', () => {
    const { editor, start, ui } = setup('fork', 'f3');
    act(() => {
      switchAlternative(editor(), 'failed');
    });
    expect(ui().activeFlow?.playing).toBe(false);
    start();
    tick(1700);
    expect(ui().activeFlow?.stepId).toBe('f4b');
    tick(1700);
    expect(ui().activeFlow).toMatchObject({ stepId: 'f5b', playing: false });
  });

  it('pauses on Next, Previous, a segment click and a speed change', () => {
    const { start, ui } = setup();
    const player = screen.getByRole('region', { name: 'Step player' });
    const pausedBy = (name: string) => {
      start();
      act(() => {
        fireEvent.click(screen.getByRole('button', { name }));
      });
      expect(ui().activeFlow?.playing).toBe(false);
    };
    expect(player).toBeInTheDocument();
    pausedBy('Next step');
    pausedBy('Previous step');
    pausedBy('Go to step 4 of 8');
    pausedBy('Speed 1×');
    expect(ui().activeFlow?.speed).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
