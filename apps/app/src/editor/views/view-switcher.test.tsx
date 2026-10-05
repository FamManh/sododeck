import { serializeDeck, toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { ViewSwitcher } from './view-switcher';

const deck = deckOf({
  nodes: [
    { id: 'app', type: 'client', title: 'App', tech: 'Swift', host: 'App Store' },
    { id: 'api', type: 'service', title: 'API', tech: 'Go', host: 'k8s' },
  ],
  edges: [{ id: 'e', from: 'app', to: 'api' }],
});

describe('views never write on open or switch (FR-001, FR-005)', () => {
  it('leaves a deck without views byte-identical after three switches', () => {
    const { doc, editor } = renderWithEditor(<Canvas />, deck);
    const before = serializeDeck(toJSON(doc));
    for (const id of ['feature', 'system', 'feature']) {
      act(() => {
        useUiStore.getState().switchView(id);
      });
    }
    expect(serializeDeck(toJSON(doc))).toBe(before);
    expect(editor().canUndo()).toBe(false);
  });
});

describe('ViewSwitcher (FR-002, FR-003)', () => {
  const tabs = () => screen.getAllByRole('tab');

  it('is a tab list "Views" with one named tab per view, the current one selected', () => {
    renderWithEditor(<ViewSwitcher />, deck);
    expect(screen.getByRole('tablist', { name: 'Views' })).toBeInTheDocument();
    expect(tabs().map((t) => t.getAttribute('aria-label'))).toEqual([
      'Overview view',
      'Flows view',
    ]);
    expect(screen.getByRole('tab', { name: 'Overview view' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1]);
  });

  it('switches on click, announces, and clears selection, drill-in and focus', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ViewSwitcher />, deck);
    act(() => {
      useUiStore.getState().select({ nodes: ['app'] });
      useUiStore.getState().setFocusMode(true);
      useUiStore
        .getState()
        .drillInto({ kind: 'node', id: 'api', viewport: { x: 0, y: 0, zoom: 1 } });
    });
    await user.click(screen.getByRole('tab', { name: 'Flows view' }));
    const ui = useUiStore.getState();
    expect(ui.currentViewId).toBe('feature');
    expect(ui.announcement.text).toBe('Flows view');
    expect(ui.selection.nodes).toEqual([]);
    expect(ui.drill).toEqual([]);
    expect(ui.focusMode).toBe(false);
    expect(screen.getByRole('tab', { name: 'Flows view' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('moves focus with arrows, Home and End, and selects with Enter or Space', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ViewSwitcher />, deck);
    await user.tab();
    expect(tabs()[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tabs()[1]).toHaveFocus();
    expect(useUiStore.getState().currentViewId).toBeNull();
    await user.keyboard('{Enter}');
    expect(useUiStore.getState().currentViewId).toBe('feature');
    await user.keyboard('{Home}');
    expect(tabs()[0]).toHaveFocus();
    await user.keyboard(' ');
    expect(useUiStore.getState().currentViewId).toBe('system');
    await user.keyboard('{End}');
    expect(tabs()[1]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tabs()[0]).toHaveFocus();
  });
});

describe('adding views and overflow (FR-040, edge case "Many views")', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds "Custom 1", selects it and toasts; the first add stores the presets too', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<ViewSwitcher />, deck);
    await user.click(screen.getByRole('button', { name: 'Add view' }));
    expect(toJSON(doc).views.map((v) => v.title)).toEqual(['Overview', 'Flows', 'Custom 1']);
    expect(screen.getByRole('tab', { name: 'Custom 1, custom view' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('View "Custom 1" created')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add view' }));
    expect(toJSON(doc).views.at(-1)?.title).toBe('Custom 2');
  });

  it('puts tabs that do not fit in "More views", keeping the current tab visible', async () => {
    const user = userEvent.setup();
    const callbacks: ((entries: unknown[]) => void)[] = [];
    const notify = () => {
      for (const callback of callbacks) callback([]);
    };
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: (entries: unknown[]) => void) {
          callbacks.push(callback);
        }
        observe() {
          return undefined;
        }
        unobserve() {
          return undefined;
        }
        disconnect() {
          return undefined;
        }
      },
    );
    const many = deckOf({
      ...deck,
      views: Array.from({ length: 8 }, (_, i) => ({
        id: `v${String(i)}`,
        type: 'custom' as const,
        title: `View ${String(i)}`,
      })),
    });
    const { container } = renderWithEditor(
      <div style={{ width: '300px' }}>
        <ViewSwitcher />
      </div>,
      many,
    );
    // jsdom has no layout: give the slot a width of 300 px.
    const slot = container.firstElementChild as HTMLElement;
    Object.defineProperty(slot, 'clientWidth', { value: 300 });
    act(() => {
      notify();
    });
    expect(screen.getAllByRole('tab').length).toBeLessThan(8);
    await user.click(screen.getByRole('button', { name: 'More views' }));
    await user.click(screen.getByRole('menuitem', { name: 'View 7' }));
    expect(useUiStore.getState().currentViewId).toBe('v7');
    expect(screen.getByRole('tab', { name: 'View 7, custom view' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows every tab without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const many = deckOf({
      ...deck,
      views: Array.from({ length: 8 }, (_, i) => ({
        id: `v${String(i)}`,
        type: 'custom' as const,
        title: `View ${String(i)}`,
      })),
    });
    renderWithEditor(<ViewSwitcher />, many);
    expect(screen.getAllByRole('tab')).toHaveLength(8);
    expect(screen.queryByRole('button', { name: 'More views' })).not.toBeInTheDocument();
  });
});
