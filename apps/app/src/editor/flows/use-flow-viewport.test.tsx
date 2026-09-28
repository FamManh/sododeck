import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { playbackDeck } from '../../test/flow-fixtures';
import { playbackOf, type Playback } from './flow-mode';
import { findFlow } from './session-path';
import { useUiStore } from '../../state/ui-store';
import { fitRectInFreeArea } from '../shell/shell-geometry';
import { currentInsets } from '../shell/shell-insets';
import { MAX_ZOOM, MIN_ZOOM } from '../zoom-limits';
import { useFlowViewport } from './use-flow-viewport';

const view = {
  fitBounds: vi.fn(() => Promise.resolve(true)),
  setCenter: vi.fn(() => Promise.resolve(true)),
  getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1.5 })),
  setViewport: vi.fn(() => Promise.resolve(true)),
};
vi.mock('@xyflow/react', () => ({ useReactFlow: () => view }));

let reduced = false;
vi.mock('@sododeck/ui/hooks/use-reduced-motion', () => ({ useReducedMotion: () => reduced }));

const wrapper = { current: { clientWidth: 1600, clientHeight: 900 } as HTMLElement };

function playback(flowId: string, stepId: string | null): Playback {
  const flow = findFlow(playbackDeck, flowId);
  if (flow === undefined) throw new Error(`no flow ${flowId}`);
  return playbackOf(playbackDeck, flow, null, stepId);
}

function mount(initial: Playback | null) {
  return renderHook(
    ({ p }) => {
      useFlowViewport(playbackDeck, p, wrapper);
    },
    {
      initialProps: { p: initial },
    },
  );
}

beforeEach(() => {
  reduced = false;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useFlowViewport', () => {
  it('fits the played path into the free area when a flow opens, without panning to the step', () => {
    const { rerender } = mount(null);
    expect(view.setViewport).not.toHaveBeenCalled();
    rerender({ p: playback('order', null) });
    expect(view.setViewport).toHaveBeenCalledTimes(1);
    expect(view.setViewport).toHaveBeenCalledWith(
      fitRectInFreeArea(
        { x: 0, y: 0, width: 764, height: 250 },
        { width: 1600, height: 900 },
        currentInsets(true),
        { padding: 0.2, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM },
      ),
      { duration: 250 },
    );
    expect(view.setCenter).not.toHaveBeenCalled();
  });

  it('keeps the fitted path clear of an open flyout (018, design 90)', () => {
    useUiStore.getState().openFlyout('flows');
    const { rerender } = mount(null);
    rerender({ p: playback('order', null) });
    const [fitted] = view.setViewport.mock.calls[0] as unknown as [{ x: number; zoom: number }];
    expect(fitted.x).toBeGreaterThanOrEqual(348);
    useUiStore.getState().closeFlyout();
  });

  it('falls back to fitBounds before the canvas is measured', () => {
    const empty = { current: { clientWidth: 0, clientHeight: 0 } as HTMLElement };
    const { rerender } = renderHook(
      ({ p }) => {
        useFlowViewport(playbackDeck, p, empty);
      },
      { initialProps: { p: null as Playback | null } },
    );
    rerender({ p: playback('order', null) });
    expect(view.fitBounds).toHaveBeenCalledWith(
      { x: 0, y: 0, width: 764, height: 250 },
      { padding: 0.2, duration: 250 },
    );
  });

  it('pans to the current step only when it is out of view, keeping the zoom', () => {
    const { rerender } = mount(playback('order', 'o1'));
    rerender({ p: playback('order', 'o2') });
    expect(view.setCenter).not.toHaveBeenCalled();
    view.getViewport.mockReturnValue({ x: 0, y: -600, zoom: 1.5 });
    rerender({ p: playback('order', 'o5') });
    expect(view.setCenter).toHaveBeenCalledWith(482, 125, { zoom: 1.5, duration: 250 });
    expect(view.setViewport).toHaveBeenCalledTimes(1);
  });

  it('moves without animation under reduced motion', () => {
    reduced = true;
    view.getViewport.mockReturnValue({ x: 0, y: -600, zoom: 1 });
    const { rerender } = mount(playback('order', 'o1'));
    expect(view.setViewport).toHaveBeenCalledWith(expect.anything(), { duration: 0 });
    rerender({ p: playback('order', 'o5') });
    expect(view.setCenter).toHaveBeenCalledWith(482, 125, { zoom: 1, duration: 0 });
  });

  it('does nothing outside flow mode', () => {
    const { rerender } = mount(null);
    rerender({ p: null });
    expect(view.fitBounds).not.toHaveBeenCalled();
    expect(view.setCenter).not.toHaveBeenCalled();
  });
});
