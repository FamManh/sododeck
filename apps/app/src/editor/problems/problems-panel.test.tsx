import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { deckOf, editorWrapper } from '../../test/render-canvas';
import { PROBLEM_ROW_CAP } from './problems-dom';
import { ProblemsPanel } from './problems-panel';

const planted = deckOf({
  nodes: [
    { id: 'gw', type: 'gateway', title: 'API Gateway' },
    { id: 'tr', type: 'service', title: 'Tracking Service' },
    { id: 'lg', type: 'service', title: 'Legacy Invoicer' },
  ],
  edges: [
    { id: 'e1', from: 'gw', to: 'tr', label: 'GPS stream' },
    { id: 'e2', from: 'gw', to: 'tr', label: 'GPS stream' },
  ],
  flows: [{ id: 'f', title: 'Proof of delivery', steps: [{ id: 's1', edge: 'gone' }] }],
});

function setup(file = planted, onActivate = vi.fn()) {
  const { wrapper, editor } = editorWrapper(file);
  render(<ProblemsPanel onActivate={onActivate} />, { wrapper });
  return { editor, onActivate, user: userEvent.setup() };
}

const rowNames = () =>
  within(screen.getByRole('list', { name: 'Problems' }))
    .getAllByRole('button')
    .map((b) => b.textContent);

describe('ProblemsPanel (015 US1, FR-012–016, FR-020)', () => {
  it('lists every problem in order, with its count and the help line', async () => {
    setup();
    const heading = await screen.findByRole('heading', { name: /Problems/ });
    expect(heading).toHaveTextContent('3');
    expect(rowNames()).toEqual([
      'Orphan componentLegacy Invoicer has no connections',
      'Duplicate connectionAPI Gateway → Tracking Service appears twice',
      'Step without connectionProof of delivery · step 1 used a deleted connection',
    ]);
    expect(screen.getByText(/Click a problem, or press ↵ on it/)).toBeInTheDocument();
  });

  it('shows "No problems" for a clean deck', async () => {
    setup(deckOf({}));
    expect(await screen.findByText('No problems')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Problems' })).not.toBeInTheDocument();
  });

  it('removes a row once the problem is fixed', async () => {
    const { editor } = setup();
    await screen.findByRole('list', { name: 'Problems' });
    act(() => {
      editor().add('edges', { id: 'e3', from: 'tr', to: 'lg' });
    });
    await vi.waitFor(() => {
      expect(rowNames()).not.toContain('Orphan componentLegacy Invoicer has no connections');
    });
  });

  it('moves focus with arrows, Home and End, and activates with Enter and Space', async () => {
    const { user, onActivate } = setup();
    await screen.findByRole('list', { name: 'Problems' });
    const rows = within(screen.getByRole('list', { name: 'Problems' })).getAllByRole('button');
    expect(rows.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    await user.tab();
    expect(rows[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(rows[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(rows[2]).toHaveFocus();
    await user.keyboard('{Home}{ArrowUp}');
    expect(rows[0]).toHaveFocus();
    expect(onActivate).not.toHaveBeenCalled();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onActivate).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'duplicate-connection' }),
    );
    await user.keyboard(' ');
    expect(onActivate).toHaveBeenCalledTimes(2);
    await user.click(rows[2] as HTMLElement);
    expect(onActivate).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'step-without-connection' }),
    );
  });

  it(`shows ${String(PROBLEM_ROW_CAP)} rows, then all of them on request`, async () => {
    const nodes = Array.from({ length: PROBLEM_ROW_CAP + 1 }, (_, i) => ({
      id: `n${String(i)}`,
      type: 'service' as const,
      title: `Lonely ${String(i).padStart(3, '0')}`,
    }));
    const { user } = setup(deckOf({ nodes }));
    await screen.findByRole('list', { name: 'Problems' });
    expect(rowNames()).toHaveLength(PROBLEM_ROW_CAP);
    await user.click(
      screen.getByRole('button', { name: `Show all ${String(PROBLEM_ROW_CAP + 1)}` }),
    );
    expect(rowNames()).toHaveLength(PROBLEM_ROW_CAP + 1);
  });
});
