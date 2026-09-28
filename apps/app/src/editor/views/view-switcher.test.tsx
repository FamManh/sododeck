import { serializeDeck, toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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
    for (const id of ['infra', 'feature', 'system']) {
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
      'System, system view',
      'Feature, feature view',
      'Infra, infra view',
    ]);
    expect(screen.getByRole('tab', { name: 'System, system view' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1]);
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
    await user.click(screen.getByRole('tab', { name: 'Infra, infra view' }));
    const ui = useUiStore.getState();
    expect(ui.currentViewId).toBe('infra');
    expect(ui.announcement.text).toBe('Infra view');
    expect(ui.selection.nodes).toEqual([]);
    expect(ui.drill).toEqual([]);
    expect(ui.focusMode).toBe(false);
    expect(screen.getByRole('tab', { name: 'Infra, infra view' })).toHaveAttribute(
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
    await user.keyboard('{End}');
    expect(tabs()[2]).toHaveFocus();
    await user.keyboard(' ');
    expect(useUiStore.getState().currentViewId).toBe('infra');
    await user.keyboard('{Home}');
    expect(tabs()[0]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tabs()[2]).toHaveFocus();
  });
});
