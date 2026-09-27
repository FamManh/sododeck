import { toJSON } from '@sododeck/model';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderAttached } from '../../test/render-attached';
import { ruleDeck } from '../../test/rule-fixtures';

/** Step a1 of "Assign driver" has no rule; step a2 has Delivery tier. */
describe('AttachRulePopover (story 5, FR-029)', () => {
  it('lists the rules with the attached ones marked, filters, and attaches with Enter', async () => {
    const { user, doc, ui } = renderAttached(ruleDeck, { flow: 'assign', step: 'a2' });
    await user.click(screen.getByRole('button', { name: 'Attach rule' }));
    const dialog = screen.getByRole('dialog', { name: 'Attach rule' });
    const options = within(dialog).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Delivery tier · 5 rowsAttached',
      'Reattempt policy · 1 row',
      'New rule',
    ]);
    expect(options[0]).toHaveAttribute('aria-disabled', 'true');
    await user.type(within(dialog).getByRole('searchbox', { name: 'Filter rules' }), 'reat');
    expect(
      within(dialog)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Reattempt policy · 1 row', 'New rule']);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog', { name: 'Attach rule' })).not.toBeInTheDocument();
    expect(toJSON(doc).flows[1]?.steps[1]?.rules).toEqual(['T', 'P']);
    expect(ui().announcement.text).toBe('Rule attached');
  });

  it('does nothing when an attached rule is chosen', async () => {
    const { user, doc } = renderAttached(ruleDeck, { flow: 'assign', step: 'a2' });
    await user.click(screen.getByRole('button', { name: 'Attach rule' }));
    await user.click(screen.getByRole('option', { name: /Delivery tier/ }));
    expect(toJSON(doc).flows[1]?.steps[1]?.rules).toEqual(['T']);
  });

  it('"New rule" creates a rule, attaches it and opens it', async () => {
    const { user, doc, openRules } = renderAttached(ruleDeck, { flow: 'assign', step: 'a1' });
    await user.click(screen.getByRole('button', { name: 'Attach rule' }));
    await user.click(screen.getByRole('option', { name: 'New rule' }));
    const rules = toJSON(doc).rules;
    const id = Object.keys(rules).find((k) => k !== 'T' && k !== 'P') ?? '';
    expect(rules[id]?.title).toBe('Untitled rule');
    expect(toJSON(doc).flows[1]?.steps[0]?.rules).toEqual([id]);
    expect(openRules).toHaveBeenCalledWith(id, { newRule: true });
  });
});
