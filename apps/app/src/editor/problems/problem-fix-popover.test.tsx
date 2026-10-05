import { toJSON } from '@sododeck/model';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { ProblemFixPopover } from './problem-fix-popover';
import { useProblems } from './use-problems';

const table = (locked = false) =>
  deckOf({
    nodes: [
      {
        id: 'log',
        type: 'db-table',
        title: 'audit_log',
        ...(locked ? { locked: true } : {}),
        columns: [{ id: 'c1', name: 'id', type: 'integer' }],
      },
    ],
  });

/** Opens the popover for the first problem once the check has run. */
function Opener() {
  const problems = useProblems();
  const key = problems?.list[0]?.key;
  return (
    <button
      type="button"
      onClick={() => {
        if (key !== undefined) useUiStore.getState().setProblemPopover({ key });
      }}
    >
      open
    </button>
  );
}

async function setup(locked = false) {
  const view = renderWithEditor(
    <>
      <Opener />
      <ProblemFixPopover />
    </>,
    table(locked),
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'open' }));
  return { ...view, user };
}

describe('ProblemFixPopover (047 US2)', () => {
  it('shows the severity icon, title, detail and the primary fix first', async () => {
    await setup();
    const dialog = await screen.findByRole('dialog', { name: 'No primary key' });
    expect(dialog).toHaveTextContent('audit_log has no primary key');
    expect(screen.getByRole('img', { name: 'Warning' })).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /PK/ });
    expect(buttons[0]).toHaveTextContent('Make id the PK');
    expect(buttons[0]).toHaveAttribute('data-variant', 'primary');
  });

  it('applies a fix in one undo step and closes', async () => {
    const { user, doc, editor } = await setup();
    await user.click(await screen.findByRole('button', { name: 'Make id the PK' }));
    expect(toJSON(doc).nodes[0]?.columns?.[0]?.pk).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useUiStore.getState().problemPopover).toBeNull();
    editor().undo();
    expect(toJSON(doc).nodes[0]?.columns?.[0]?.pk).toBeUndefined();
  });

  it('closes on Escape and on an outside click', async () => {
    const { user } = await setup();
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useUiStore.getState().problemPopover).toBeNull();
    await user.click(screen.getByRole('button', { name: 'open' }));
    await screen.findByRole('dialog');
    await user.click(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays open when focus moves to the faulty row behind it', async () => {
    // Going to a problem focuses its canvas row right after the popover opens (047 R7).
    const { user } = await setup();
    await screen.findByRole('dialog');
    const row = document.createElement('div');
    row.tabIndex = 0;
    document.body.append(row);
    act(() => {
      row.focus();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('dialog', { name: 'No primary key' })).toBeInTheDocument();
    row.remove();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the problem disappears', async () => {
    const { editor } = await setup();
    await screen.findByRole('dialog');
    act(() => {
      editor().updateColumn('log', 'c1', { pk: true });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(useUiStore.getState().problemPopover).toBeNull();
  });

  it('disables the fixes of a locked table with the reason', async () => {
    await setup(true);
    const button = await screen.findByRole('button', { name: 'Locked · unlock to fix' });
    expect(button).toBeDisabled();
  });
});
