import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { inspectorDeck } from '../../test/inspector-fixtures';
import { renderInspector } from '../../test/render-inspector';
import { useUiStore } from '../../state/ui-store';

/** The drawer's Line section is the same component as the popover body. */
const setup = (edges = ['op']) => renderInspector(inspectorDeck, { edges });
const style = (doc: Parameters<typeof toJSON>[0], index = 0) => toJSON(doc).edges[index]?.style;

describe('Line style controls (022 US1)', () => {
  it('has the roles and names of the contract', () => {
    setup();
    expect(screen.getByRole('radiogroup', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Dash' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Weight' })).toHaveAttribute(
      'aria-valuetext',
      '2 px, default',
    );
    expect(screen.getByRole('radiogroup', { name: 'Colour' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Animate direction' })).not.toBeChecked();
  });

  it('writes only the picked key, one undo step per pick', async () => {
    const { user, doc, editor } = setup();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Dash' })).getByRole('radio', {
        name: 'Dashed',
      }),
    );
    expect(style(doc)).toEqual({ dash: 'dashed' });
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', {
        name: 'Blue',
      }),
    );
    expect(style(doc)).toEqual({ dash: 'dashed', color: 'blue' });
    await user.click(screen.getByRole('switch', { name: 'Animate direction' }));
    expect(style(doc)).toEqual({ dash: 'dashed', color: 'blue', animated: true });
    act(() => {
      editor().undo();
    });
    expect(style(doc)).toEqual({ dash: 'dashed', color: 'blue' });
  });

  it('"No colour" and the default dash remove their keys', async () => {
    const { user, doc } = setup();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', {
        name: 'Red',
      }),
    );
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', {
        name: 'No colour',
      }),
    );
    expect(style(doc)).toBeUndefined();
    expect(toJSON(doc).edges[0]).not.toHaveProperty('style');
  });

  it('moves the weight with arrows, Home and End, and says the value', async () => {
    const { user, doc } = setup();
    const slider = screen.getByRole('slider', { name: 'Weight' });
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(style(doc)).toEqual({ width: 3 });
    expect(slider).toHaveAttribute('aria-valuetext', '3 px');
    await user.keyboard('{End}');
    expect(style(doc)).toEqual({ width: 4 });
    await user.keyboard('{Home}');
    expect(style(doc)).toEqual({ width: 1 });
    await user.keyboard('{ArrowRight}{ArrowRight}');
    // 1.5 then 2: back to the default, which is not stored.
    expect(toJSON(doc).edges[0]).not.toHaveProperty('style');
  });

  it('shows Mixed for connectors that differ, and a pick writes that key to all', async () => {
    const { user, doc, editor } = setup(['op', 'py']);
    act(() => {
      editor().setEdgeStyle(['py'], { dash: 'dotted', width: 3 });
    });
    expect(screen.getAllByText('Mixed').length).toBeGreaterThanOrEqual(2);
    const dash = screen.getByRole('radiogroup', { name: 'Dash' });
    expect(within(dash).queryByRole('radio', { checked: true })).toBeNull();
    await user.click(within(dash).getByRole('radio', { name: 'Dashed' }));
    expect(style(doc, 0)).toEqual({ dash: 'dashed' });
    expect(style(doc, 1)).toEqual({ dash: 'dashed', width: 3 });
  });
});

describe('Weight slider pointer drag (050 US3)', () => {
  beforeEach(() => {
    useUiStore.getState().resetForDeck();
    // Drag frames run at once (the drag helper throttles moves to animation frames).
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** The track spans x 0–100, so the five stops sit at 10, 30, 50, 70 and 90. */
  const track = () => {
    const slider = screen.getByRole('slider', { name: 'Weight' });
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 100,
      bottom: 24,
      width: 100,
      height: 24,
      toJSON: () => ({}),
    });
    return slider;
  };
  const down = (el: HTMLElement, x: number) =>
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: x, clientY: 12 });
  const move = (x: number) =>
    fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: 12 });
  const up = (x: number) => fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: 12 });
  const preview = () => useUiStore.getState().lineStylePreview;

  it('previews every stop while dragged, then writes once on release (one undo step)', () => {
    const { doc, editor } = setup();
    const slider = track();
    down(slider, 10);
    const seen: (number | undefined)[] = [];
    for (const x of [30, 50, 70, 90]) {
      move(x);
      seen.push(preview()?.width);
      expect(preview()?.edgeIds).toEqual(['op']);
      expect(style(doc)).toBeUndefined();
    }
    expect(seen).toEqual([1.5, 2, 3, 4]);
    expect(slider).toHaveAttribute('aria-valuenow', '4');
    up(90);
    expect(preview()).toBeNull();
    expect(style(doc)).toEqual({ width: 4 });
    act(() => {
      editor().undo();
    });
    expect(style(doc)).toBeUndefined();
  });

  it('writes nothing when Esc cancels the drag', () => {
    const { doc } = setup();
    const slider = track();
    down(slider, 10);
    move(90);
    expect(preview()?.width).toBe(4);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(preview()).toBeNull();
    up(90);
    expect(toJSON(doc).edges[0]).not.toHaveProperty('style');
    expect(slider).toHaveAttribute('aria-valuenow', '2');
  });

  it('keeps the press from selecting the stop numbers as text, and focuses the slider', () => {
    setup();
    const slider = track();
    // fireEvent returns false when the handler prevented the default (text selection) action.
    expect(down(slider, 10)).toBe(false);
    expect(slider).toHaveFocus();
    up(10);
  });

  it('picks the nearest stop on a click on the track', () => {
    const { doc } = setup();
    const slider = track();
    down(slider, 72);
    up(72);
    expect(style(doc)).toEqual({ width: 3 });
    down(slider, 2);
    up(2);
    expect(style(doc)).toEqual({ width: 1 });
  });

  it('gives several selected connectors the value in one undo step', () => {
    const { doc, editor } = setup(['op', 'py']);
    act(() => {
      editor().setEdgeStyle(['py'], { width: 3 });
    });
    const slider = track();
    down(slider, 10);
    move(50);
    move(90);
    expect(preview()?.edgeIds).toEqual(['op', 'py']);
    up(90);
    expect(style(doc, 0)).toEqual({ width: 4 });
    expect(style(doc, 1)).toEqual({ width: 4 });
    act(() => {
      editor().undo();
    });
    expect(style(doc, 0)).toBeUndefined();
    expect(style(doc, 1)).toEqual({ width: 3 });
  });
});
