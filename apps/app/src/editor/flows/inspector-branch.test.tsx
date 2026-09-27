import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck } from '../../test/flow-fixtures';
import { renderFlows } from '../../test/render-flows';
import { recordClick, startBranch, startEditing } from './flow-session';

describe('InspectorBranch (US4, FR-022, FR-023, FR-028)', () => {
  it('requires a label and a condition on Done, focusing the first empty field', async () => {
    const { user, editor, ui, doc } = renderFlows(flowDeck);
    act(() => {
      startEditing(editor(), 'place');
      startBranch(editor(), 's2');
    });
    expect(screen.getByRole('heading', { name: 'New branch' })).toBeInTheDocument();
    const label = screen.getByRole('textbox', { name: 'New branch · Label' });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Enter a label')).toBeInTheDocument();
    expect(screen.getByText('Enter a condition')).toBeInTheDocument();
    expect(label).toHaveFocus();
    expect(label).toHaveAttribute('aria-invalid', 'true');
    expect(ui().flowSession?.addingBranch).toBe(true);

    await user.type(label, 'payment failed{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Condition' }), 'declined{Enter}');
    await user.click(screen.getByRole('switch', { name: 'Error path' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(ui().flowSession?.addingBranch).toBe(false);
    expect(ui().announcement.text).toBe('Branch ‘payment failed’ added after step 2');
    expect(toJSON(doc).flows[0]?.branches).toEqual([
      {
        id: expect.any(String) as string,
        label: 'payment failed',
        condition: 'declined',
        errorPath: true,
      },
    ]);
    // Recording continues in the branch.
    act(() => {
      recordClick(editor(), 'cx');
    });
    expect(toJSON(doc).flows[0]?.steps.at(-1)?.branch).toBe(
      toJSON(doc).flows[0]?.branches?.[0]?.id,
    );
  });

  it('edits a branch and deletes it after confirming', async () => {
    const { user, ui, doc } = renderFlows(branchedDeck);
    act(() => {
      ui().setActiveFlow('pay');
      ui().setActiveBranch('ok');
    });
    const label = screen.getByRole('textbox', { name: 'Label' });
    await user.clear(label);
    await user.type(label, 'paid{Enter}');
    expect(screen.getByRole('button', { name: 'Branch a: paid' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete branch…' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete ‘branch paid’?' });
    expect(dialog).toHaveTextContent('Its 1 step will be deleted.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(
      toJSON(doc)
        .flows.at(-1)
        ?.branches?.map((b) => b.id),
    ).toEqual(['fail']);
  });
});
