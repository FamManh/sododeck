import { createEditor, toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { useUiStore } from '../../state/ui-store';
import { renderAttached } from '../../test/render-attached';
import { ruleDeck } from '../../test/rule-fixtures';

describe('AttachedRules (story 5, FR-030, FR-033)', () => {
  it('shows one shared rule on two steps, updated by an edit here and from another tab', () => {
    const { doc, editor } = renderAttached(ruleDeck, { flow: 'place', step: 'p2' });
    const firstCell = () =>
      within(screen.getByRole('table', { name: 'Delivery tier' })).getAllByRole('cell')[3];
    expect(firstCell()).toHaveTextContent('Bike');
    act(() => {
      editor().setRuleCell('T', 'r1', 'veh', 'Scooter');
    });
    expect(firstCell()).toHaveTextContent('Scooter');
    act(() => {
      useUiStore.getState().setActiveFlow('assign');
      useUiStore.getState().setActiveStep('a2');
    });
    expect(firstCell()).toHaveTextContent('Scooter');
    // SC-004: an edit made in another tab arrives as a remote change.
    const theirs = new Y.Doc();
    Y.applyUpdate(theirs, Y.encodeStateAsUpdate(doc));
    createEditor(theirs).setRuleCell('T', 'r1', 'veh', 'Cargo bike');
    act(() => {
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(theirs, Y.encodeStateVector(doc)));
    });
    expect(firstCell()).toHaveTextContent('Cargo bike');
    expect(toJSON(doc).rules.T?.rows[0]?.then[0]).toBe('Cargo bike');
  });

  it('attaches and detaches rules on a component, and a rule row opens the editor', async () => {
    const { user, doc, openRules } = renderAttached(ruleDeck, { node: 'p' });
    const section = screen.getByRole('region', { name: 'Rules' });
    await user.click(within(section).getByRole('button', { name: 'Delivery tier' }));
    expect(openRules).toHaveBeenCalledWith('T');
    await user.click(within(section).getByRole('button', { name: 'Attach rule' }));
    await user.click(screen.getByRole('option', { name: /Reattempt policy/ }));
    expect(toJSON(doc).nodes[2]?.rules).toEqual(['T', 'P']);
    await user.click(within(section).getByRole('button', { name: 'Detach Delivery tier' }));
    expect(toJSON(doc).nodes[2]?.rules).toEqual(['P']);
  });
});
