import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LayoutRequest, LayoutResult } from '../../layout/elk-layout';
import type * as LayoutClientModule from '../../layout/layout-client';
import { useUiStore } from '../../state/ui-store';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { DeckIsland } from '../shell/deck-island';

/** Tidy layout lives in the current view's menu in the deck island since 018 (§g-46). */
function Island() {
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <MemoryRouter>
      <DeckIsland deck={deck} />
    </MemoryRouter>
  );
}

const fake = vi.hoisted(() => ({
  requests: [] as LayoutRequest[],
  resolve: null as ((result: LayoutResult) => void) | null,
  reject: null as ((error: Error) => void) | null,
  cancels: 0,
}));

vi.mock('../../layout/layout-client', async (importOriginal) => {
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
/** Opens the current view's menu and returns its "Tidy layout" item. */
async function tidy(user = userEvent.setup()) {
  if (screen.queryByRole('menu') === null) {
    const [options] = screen.getAllByRole('button', { name: /^View options for / });
    if (options === undefined) throw new Error('no view menu');
    await user.click(options);
  }
  return screen.getByRole('menuitem', { name: /Tidy layout/ });
}
const disabled = (item: HTMLElement) => item.getAttribute('aria-disabled') === 'true';

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

  it('is disabled with a reason: flow open, nothing to arrange, all pinned', async () => {
    const { unmount } = renderWithEditor(<Island />, deckOf({}));
    let item = await tidy();
    expect(disabled(item)).toBe(true);
    expect(item).toHaveAccessibleDescription('Nothing to arrange');
    unmount();

    const pinned = renderWithEditor(
      <Island />,
      deckOf({
        ...deck,
        views: [{ id: 'v', type: 'system', title: 'V', pinned: ['a', 'b', 'c'] }],
      }),
    );
    expect(await tidy()).toHaveAccessibleDescription('All components are pinned');
    pinned.unmount();

    renderWithEditor(<Island />, deck);
    item = await tidy();
    expect(disabled(item)).toBe(false);
    act(() => {
      // Flow mode (a session hides the views menu behind its chip).
      ui().openFlow('f');
    });
    item = await tidy();
    expect(disabled(item)).toBe(true);
    expect(item).toHaveAccessibleDescription('Not available while a flow is open');
  });

  it('applies the result as one undo step and announces it', async () => {
    const { doc, editor } = renderWithEditor(<Island />, deck);
    const user = userEvent.setup();
    await user.click(await tidy(user));
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const { doc } = renderWithEditor(<Island />, deck);
    const before = toJSON(doc);
    await user.click(await tidy(user));
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
    expect(disabled(await tidy(user))).toBe(false);
  });

  it('moves only the drilled scope, and skips components deleted meanwhile', async () => {
    const { doc, editor } = renderWithEditor(<Island />, deck);
    act(() => {
      ui().drillInto({ kind: 'group', id: 'g', viewport: { x: 0, y: 0, zoom: 1 } });
    });
    const user = userEvent.setup();
    await user.click(await tidy(user));
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
