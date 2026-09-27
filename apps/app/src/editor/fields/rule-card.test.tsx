import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderAttached } from '../../test/render-attached';
import { deliveryTier, ruleDeck } from '../../test/rule-fixtures';

const card = () => screen.getByRole('article', { name: 'Delivery tier' });

describe('RuleCard on a step (story 5, FR-031)', () => {
  it('shows the compact table, the sample inputs and the matched row', () => {
    renderAttached(ruleDeck, { flow: 'place', step: 'p2' });
    expect(screen.getByRole('region', { name: 'Attached rules' })).toHaveTextContent(
      'Attached rules 1',
    );
    const table = within(card()).getByRole('table', { name: 'Delivery tier' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveAttribute('aria-selected', 'true');
    expect(rows[2]).toHaveAttribute('aria-selected', 'false');
    expect(within(rows[3] as HTMLElement).getAllByRole('cell')[2]).toHaveTextContent('Any');
    expect(
      within(card()).getByText(
        'Evaluated with Distance (km) 5 · Weight (kg) 10 · Priority Express',
      ),
    ).toBeInTheDocument();
    expect(within(card()).getByRole('status')).toHaveTextContent(
      'Row 1 matches → Bike · 45 min · €4.00',
    );
  });

  it('saves sample inputs with the step as the user types, and the result follows', async () => {
    const { user, doc } = renderAttached(ruleDeck, { flow: 'place', step: 'p2' });
    const priority = within(card()).getByRole('textbox', { name: 'Priority' });
    await user.clear(priority);
    await user.type(priority, 'Standard');
    expect(toJSON(doc).flows[0]?.steps[1]?.ruleInputs).toEqual({
      T: { dist: '5', weight: '10', prio: 'Standard' },
    });
    expect(within(card()).getByRole('status')).toHaveTextContent(
      'Row 2 matches → Bike · 2 h · €0.00',
    );
    const weight = within(card()).getByRole('textbox', { name: 'Weight (kg)' });
    await user.clear(weight);
    await user.type(weight, '200');
    await user.clear(within(card()).getByRole('textbox', { name: 'Distance (km)' }));
    expect(within(card()).getByRole('status')).toHaveTextContent('Row 5 matches');
    await user.clear(weight);
    expect(within(card()).getByRole('status')).toHaveTextContent('No row matches these inputs');
  });

  it('shows the Unique ambiguity on the card', () => {
    const unique = {
      ...ruleDeck,
      rules: { ...ruleDeck.rules, T: { ...deliveryTier, hitPolicy: 'unique' as const } },
    };
    renderAttached(unique, { flow: 'place', step: 'p2' });
    expect(within(card()).getByRole('status')).toHaveTextContent(
      '2 rows match; Unique expects one (Rows 1 and 3)',
    );
  });

  it('detaches without a dialog, and ⌘Z restores the rule and its inputs', async () => {
    const { user, doc, editor, ui } = renderAttached(ruleDeck, { flow: 'place', step: 'p2' });
    await user.click(within(card()).getByRole('button', { name: 'Detach Delivery tier' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toJSON(doc).flows[0]?.steps[1]).toEqual({ id: 'p2', edge: 'op' });
    expect(screen.getByText('No decision table on this step.')).toBeInTheDocument();
    expect(ui().announcement.text).toBe('Rule detached');
    expect(screen.getByText(/Rule “Delivery tier” detached/)).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).flows[0]?.steps[1]?.ruleInputs).toEqual({
      T: { dist: '5', weight: '10', prio: 'Express' },
    });
  });

  it('"Edit rule" opens the rule editor with TEST INPUT from the step', async () => {
    const { user, openRules, ui } = renderAttached(ruleDeck, { flow: 'place', step: 'p2' });
    await user.click(within(card()).getByRole('button', { name: 'Edit rule' }));
    expect(ui().ruleTest).toEqual({
      ruleId: 'T',
      values: { dist: '5', weight: '10', prio: 'Express' },
      from: { flowId: 'place', stepId: 'p2' },
    });
    expect(openRules).toHaveBeenCalledWith('T');
  });

  it('shows a missing rule with Detach instead of dropping it', async () => {
    const missing = {
      ...ruleDeck,
      flows: ruleDeck.flows.map((f) =>
        f.id === 'assign'
          ? { ...f, steps: f.steps.map((s) => (s.id === 'a1' ? { ...s, rules: ['GONE'] } : s)) }
          : f,
      ),
    };
    const { user, doc } = renderAttached(missing, { flow: 'assign', step: 'a1' });
    expect(screen.getByText('Missing rule GONE')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Detach GONE' }));
    expect(toJSON(doc).flows[1]?.steps[0]?.rules).toBeUndefined();
  });
});
