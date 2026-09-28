import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LayoutRequest, LayoutResult } from '../layout/elk-layout';
import type * as LayoutClientModule from '../layout/layout-client';
import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { CanvasToolbar } from './canvas-toolbar';

const fake = vi.hoisted(() => ({
  requests: [] as LayoutRequest[],
  resolve: null as ((result: LayoutResult) => void) | null,
  reject: null as ((error: Error) => void) | null,
  cancels: 0,
}));

vi.mock('../layout/layout-client', async (importOriginal) => {
  const original = await importOriginal<typeof LayoutClientModule>();
  return {
    ...original,
    createLayoutClient: () => ({
      layout: (request: LayoutRequest) =>
        new Promise<LayoutResult>((resolve, reject) => {
          fake.requests.push(request);
          fake.resolve = resolve;
          fake.reject = reject;
        }),
      cancel: () => {
        fake.cancels++;
        fake.reject?.(new original.LayoutCancelled());
      },
      terminate: () => undefined,
    }),
  };
});

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'g', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', group: 'g', position: { x: 0, y: 200 } },
    { id: 'c', type: 'database', title: 'C', position: { x: 400, y: 0 } },
  ],
  groups: [{ id: 'g', title: 'G' }],
  edges: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
  ],
});
const ui = () => useUiStore.getState();
const tidy = () => screen.getByRole('button', { name: 'Tidy layout' });

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('Tidy layout (011 FR-030–FR-036)', () => {
  beforeEach(() => {
    fake.requests = [];
    fake.resolve = null;
    fake.reject = null;
    fake.cancels = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is disabled with a reason: flow open, nothing to arrange, all pinned', () => {
    const { unmount } = renderWithEditor(<CanvasToolbar />, deckOf({}));
    expect(tidy()).toBeDisabled();
    expect(tidy()).toHaveAttribute('title', 'Nothing to arrange');
    unmount();

    const pinned = renderWithEditor(
      <CanvasToolbar />,
      deckOf({
        ...deck,
        views: [{ id: 'v', type: 'system', title: 'V', pinned: ['a', 'b', 'c'] }],
      }),
    );
    expect(tidy()).toHaveAttribute('title', 'All components are pinned');
    pinned.unmount();

    renderWithEditor(<CanvasToolbar />, deck);
    expect(tidy()).toBeEnabled();
    act(() => {
      ui().startRecording('New flow', null);
    });
    expect(tidy()).toBeDisabled();
    expect(tidy()).toHaveAttribute('title', 'Not available while a flow is open');
  });

  it('applies the result as one undo step and announces it', async () => {
    const { doc, editor } = renderWithEditor(<CanvasToolbar />, deck);
    fireEvent.click(tidy());
    expect(fake.requests[0]?.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    await act(async () => {
      fake.resolve?.({ a: { x: 0, y: 0 }, b: { x: 250, y: 0 }, c: { x: 500, y: 0 } });
      await Promise.resolve();
    });
    await settle();
    expect(toJSON(doc).nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 0 },
      { x: 250, y: 0 },
      { x: 500, y: 0 },
    ]);
    expect(ui().announcement.text).toBe('Layout tidied, 2 components moved');
    expect(ui().layoutRun.status).toBe('idle');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 200 },
      { x: 400, y: 0 },
    ]);
    expect(editor().canUndo()).toBe(false);
  });

  it('shows progress and Cancel after 500 ms; Cancel changes nothing', async () => {
    vi.useFakeTimers();
    const { doc } = renderWithEditor(<CanvasToolbar />, deck);
    const before = toJSON(doc);
    fireEvent.click(tidy());
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('progressbar', { name: 'Tidying layout' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel layout' }));
    await settle();
    await settle();
    expect(fake.cancels).toBe(1);
    expect(toJSON(doc)).toEqual(before);
    expect(ui().announcement.text).toBe('Layout cancelled');
    expect(tidy()).toBeEnabled();
  });

  it('moves only the drilled scope, and skips components deleted meanwhile', async () => {
    const { doc, editor } = renderWithEditor(<CanvasToolbar />, deck);
    act(() => {
      ui().drillInto({ kind: 'group', id: 'g', viewport: { x: 0, y: 0, zoom: 1 } });
    });
    fireEvent.click(tidy());
    expect(fake.requests[0]?.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    act(() => {
      editor().remove('nodes', 'b');
    });
    await act(async () => {
      fake.resolve?.({ a: { x: 900, y: 900 }, b: { x: 950, y: 900 } });
      await Promise.resolve();
    });
    await settle();
    const nodes = toJSON(doc).nodes;
    expect(nodes.map((n) => [n.id, n.position])).toEqual([
      ['a', { x: 900, y: 900 }],
      ['c', { x: 400, y: 0 }],
    ]);
  });
});
