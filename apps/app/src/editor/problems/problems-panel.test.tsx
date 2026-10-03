import { toJSON } from '@sododeck/model';
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
  rules: {
    R: { title: 'Delivery tier', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
  },
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
      'Duplicate connectionAPI Gateway → Tracking Service appears twice',
      'Step without connectionProof of delivery · step 1 used a deleted connection',
      'Rule without catch-allDelivery tier · some inputs match no row',
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
      editor().remove('edges', 'e2');
    });
    await vi.waitFor(() => {
      expect(rowNames()).not.toContain(
        'Duplicate connectionAPI Gateway → Tracking Service appears twice',
      );
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
      expect.objectContaining({ kind: 'step-without-connection' }),
    );
    await user.keyboard(' ');
    expect(onActivate).toHaveBeenCalledTimes(2);
    await user.click(rows[2] as HTMLElement);
    expect(onActivate).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'rule-without-catch-all' }),
    );
  });

  it(`shows ${String(PROBLEM_ROW_CAP)} rows, then all of them on request`, async () => {
    // One rule without a catch-all row each.
    const rules = Object.fromEntries(
      Array.from({ length: PROBLEM_ROW_CAP + 1 }, (_, i) => [
        `r${String(i)}`,
        {
          title: `Rule ${String(i).padStart(3, '0')}`,
          hitPolicy: 'first' as const,
          inputs: [],
          outputs: [],
          rows: [],
        },
      ]),
    );
    const { user } = setup(deckOf({ rules }));
    await screen.findByRole('list', { name: 'Problems' });
    expect(rowNames()).toHaveLength(PROBLEM_ROW_CAP);
    await user.click(
      screen.getByRole('button', { name: `Show all ${String(PROBLEM_ROW_CAP + 1)}` }),
    );
    expect(rowNames()).toHaveLength(PROBLEM_ROW_CAP + 1);
  });
});

describe('ProblemsPanel card types and packs (030)', () => {
  it('lists an unknown card type and an unknown pack and activates the row', async () => {
    const file = deckOf({
      packs: ['architecture', 'future-pack'],
      nodes: [
        { id: 'a', type: 'robot', title: 'Rover' },
        { id: 'b', type: 'robot', title: 'Walker' },
      ],
    });
    const { onActivate, user } = setup(file);
    await screen.findByRole('heading', { name: /Problems/ });
    expect(rowNames()).toEqual([
      'Unknown card type robotRover, Walker use a type this version does not know',
      'Unknown pack future-packKept in the file; this version has no types for it',
    ]);
    await user.click(screen.getByRole('button', { name: /Unknown card type robot/ }));
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({ target: { type: 'nodes', ids: ['a', 'b'] } }),
    );
  });
});

describe('ProblemsPanel typed field values (032 FR-017)', () => {
  it('offers Remove value on a dangling value, clearing it in one undo step', async () => {
    const file = deckOf({
      nodes: [{ id: 'w', type: 'warehouse', title: 'Hub', values: { gone: 'Cold' } }],
    });
    const { editor, user } = setup(file);
    const list = await screen.findByRole('list', { name: 'Problems' });
    expect(within(list).getByText('Value without a field')).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Remove value' }));
    expect(toJSON(editor().doc).nodes[0]?.values).toBeUndefined();
    expect(await screen.findByText('No problems')).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(editor().doc).nodes[0]?.values).toEqual({ gone: 'Cold' });
  });
});
