import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { flowDeck } from '../../test/flow-fixtures';
import { announced, renderFlows } from '../../test/render-flows';
import { openFlow } from './flow-mode';
import { recordClick, startEditing, startNewFlow } from './flow-session';

const done = () => screen.getByRole('button', { name: 'Done' });

describe('SessionChip: recording (US1)', () => {
  it('reads "Recording \'…\' · 0 steps" with Done disabled and its reason', () => {
    renderFlows(flowDeck);
    act(() => {
      startNewFlow('Place order', 'delivery');
    });
    expect(screen.getByText('Recording ‘Place order’ · 0 steps')).toBeInTheDocument();
    expect(done()).toHaveAttribute('aria-disabled', 'true');
    expect(done()).toHaveAccessibleDescription('Add at least one step first.');
    expect(screen.getByRole('button', { name: /Undo last step/ })).toBeDisabled();
  });

  it('counts steps, undoes the last with the button and ⌘Z, and saves with Done', async () => {
    const { user, editor, ui } = renderFlows(flowDeck);
    act(() => {
      startNewFlow('Checkout', 'delivery');
      recordClick(editor(), 'ab');
      recordClick(editor(), 'bc');
      recordClick(editor(), 'cd');
    });
    expect(screen.getByText('Recording ‘Checkout’ · 3 steps')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Undo last step/ }));
    expect(screen.getByText('Recording ‘Checkout’ · 2 steps')).toBeInTheDocument();
    act(() => {
      document.body.focus();
    });
    await user.keyboard('{Meta>}z{/Meta}');
    expect(screen.getByText('Recording ‘Checkout’ · 1 step')).toBeInTheDocument();
    expect(done()).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(done());
    expect(ui().flowSession).toBeNull();
    expect(await screen.findByText('Saved flow ‘Checkout’ · 1 step')).toBeInTheDocument();
    expect(toJSON(editor().doc).flows.at(-1)?.steps).toHaveLength(1);
  });

  it('Esc without steps ends at once; with steps it asks, and Discard removes the flow', async () => {
    const { user, editor, ui, doc } = renderFlows(flowDeck);
    act(() => {
      startNewFlow('X', null);
    });
    await user.keyboard('{Escape}');
    expect(ui().flowSession).toBeNull();
    expect(announced()).toBe('Recording cancelled');

    act(() => {
      startNewFlow('Y', null);
      recordClick(editor(), 'ab');
    });
    await user.keyboard('{Escape}');
    const dialog = screen.getByRole('alertdialog', { name: 'Discard ‘Y’?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(ui().flowSession).not.toBeNull();
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(ui().flowSession).toBeNull();
    expect(toJSON(doc)).toEqual(flowDeck);
  });
});

describe('SessionChip: edit mode (US3)', () => {
  it('reads "Editing \'…\'", and Cancel restores the order but keeps a new title', async () => {
    const { user, editor, doc } = renderFlows(flowDeck);
    act(() => {
      startEditing(editor(), 'place');
    });
    expect(screen.getByText('Editing ‘Place order’')).toBeInTheDocument();
    act(() => {
      editor().moveStep('place', 's1', 1);
      editor().updateStep('place', 's2', { title: 'Create order' });
    });
    // The swap breaks the chain: Done is disabled with the reason.
    expect(done()).toHaveAccessibleDescription(
      "Step 2 doesn't start where the previous step ended.",
    );
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    await user.click(
      within(
        screen.getByRole('alertdialog', { name: 'Discard changes to ‘Place order’?' }),
      ).getByRole('button', { name: 'Discard' }),
    );
    const flow = toJSON(doc).flows[0];
    expect(flow?.steps.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(flow?.steps[1]?.title).toBe('Create order');
  });

  it('Cancel without structural changes ends without asking', async () => {
    const { user, editor, ui } = renderFlows(flowDeck);
    act(() => {
      startEditing(editor(), 'place');
    });
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(ui().flowSession).toBeNull();
    expect(ui().activeFlow?.flowId).toBe('place');
  });
});

describe('SessionChip: flow mode (007)', () => {
  it('reads "Flow · <flow>" and exits with its button', async () => {
    const { user, ui, editor } = renderFlows(flowDeck);
    act(() => {
      openFlow(editor(), 'place');
    });
    expect(screen.getByText('Flow · Place order')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Exit flow Place order' }));
    expect(ui().activeFlow).toBeNull();
    expect(screen.queryByText('Flow · Place order')).toBeNull();
  });

  it('shows the session chip instead while editing', () => {
    const { editor } = renderFlows(flowDeck);
    act(() => {
      openFlow(editor(), 'place');
      startEditing(editor(), 'place');
    });
    expect(screen.queryByText('Flow · Place order')).toBeNull();
    expect(screen.getByTitle('Editing ‘Place order’')).toBeInTheDocument();
  });
});
