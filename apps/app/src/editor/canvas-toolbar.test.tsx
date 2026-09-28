import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { CanvasToolbar } from './canvas-toolbar';
import { DeckInspector } from './inspector/deck-inspector';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';

function ToolbarAndInspector() {
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <CanvasToolbar />
      {useUiStore((st) => st.selection.nodes.length === 0 && st.activeFlow === null) && (
        <DeckInspector deck={deck} />
      )}
    </>
  );
}

const twoOrphans = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
  ],
  flows: [{ id: 'f', title: 'F', steps: [] }],
});

describe('problems button (015 US3, FR-024)', () => {
  it('shows the count, is absent without problems, and opens the list from flow mode', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolbarAndInspector />, twoOrphans);
    const button = await screen.findByRole('button', { name: '3 problems' });
    act(() => {
      useUiStore.getState().openFlow('f');
      useUiStore.getState().select({ nodes: ['a'] });
    });
    await user.click(button);
    expect(useUiStore.getState().activeFlow).toBeNull();
    expect(useUiStore.getState().selection.nodes).toEqual([]);
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /A has no connections/ })).toHaveFocus();
    });
  });

  it('is absent for a clean deck', async () => {
    renderWithEditor(<CanvasToolbar />, deckOf({}));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: /problems?$/ })).not.toBeInTheDocument();
  });
});

describe('CanvasToolbar', () => {
  it('shows the count only for two or more selected items', () => {
    renderWithEditor(<CanvasToolbar />);
    act(() => {
      useUiStore.getState().select({ nodes: ['a'] });
    });
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    act(() => {
      useUiStore.getState().select({ nodes: ['a', 'b'], edges: ['e'] });
    });
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('toggles Labels', async () => {
    const user = userEvent.setup();
    renderWithEditor(<CanvasToolbar />);
    const labels = screen.getByRole('button', { name: 'Labels' });
    expect(labels).toHaveAttribute('aria-pressed', 'false');
    await user.click(labels);
    expect(labels).toHaveAttribute('aria-pressed', 'true');
    expect(useUiStore.getState().labelsOn).toBe(true);
  });

  it('shows a Focus toggle and disables it while a flow is shown', async () => {
    const user = userEvent.setup();
    renderWithEditor(<CanvasToolbar />);
    const focus = screen.getByRole('button', { name: 'Focus' });
    expect(focus).toHaveAttribute('aria-pressed', 'false');
    expect(focus).toHaveAttribute('title', 'Focus · F');
    await user.click(focus);
    expect(useUiStore.getState().focusMode).toBe(true);

    act(() => {
      useUiStore.getState().openFlow('order', 'o1');
    });
    expect(screen.getByRole('button', { name: 'Focus' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Focus' })).toHaveAttribute(
      'title',
      'Not available while a flow is shown',
    );
  });

  it('shows the Notes switch only in flow mode and updates notesDisplay from its menu', async () => {
    const user = userEvent.setup();
    renderWithEditor(<CanvasToolbar />);
    expect(screen.queryByRole('button', { name: 'Notes: dimmed' })).not.toBeInTheDocument();

    act(() => {
      useUiStore.getState().openFlow('order', 'o1');
    });

    const trigger = screen.getByRole('button', { name: 'Notes: dimmed' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Notes during flows' });
    expect(within(menu).getByRole('menuitemradio', { name: 'Dimmed' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Shown' }));
    expect(useUiStore.getState().notesDisplay).toBe('shown');
    expect(screen.getByRole('button', { name: 'Notes: shown' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notes: shown' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Hidden' }));
    expect(useUiStore.getState().notesDisplay).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Notes: hidden' })).toBeInTheDocument();
  });

  describe('Pin / Unpin (011 FR-023)', () => {
    const file = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A' },
        { id: 'b', type: 'service', title: 'B' },
      ],
      views: [{ id: 'v', type: 'system', title: 'V', pinned: ['a'] }],
    });
    const pinned = (doc: Parameters<typeof toJSON>[0]) => toJSON(doc).views[0]?.pinned;

    it('appears only when components are selected', () => {
      renderWithEditor(<CanvasToolbar />, file);
      expect(screen.queryByRole('button', { name: 'Pin' })).not.toBeInTheDocument();
      act(() => {
        useUiStore.getState().select({ nodes: ['a'] });
      });
      expect(screen.getByRole('button', { name: 'Unpin' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('pins a mixed selection in one step, then unpins them all', async () => {
      const user = userEvent.setup();
      const { doc, editor } = renderWithEditor(<CanvasToolbar />, file);
      act(() => {
        useUiStore.getState().select({ nodes: ['a', 'b'] });
      });
      await user.click(screen.getByRole('button', { name: 'Pin' }));
      expect(pinned(doc)).toEqual(['a', 'b']);
      expect(useUiStore.getState().announcement.text).toBe('Pinned 2 components');
      await user.click(screen.getByRole('button', { name: 'Unpin' }));
      expect(pinned(doc)).toBeUndefined();
      act(() => {
        editor().undo();
      });
      expect(pinned(doc)).toEqual(['a', 'b']);
    });
  });
});
