import { serializeDeck, toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { renderRules } from '../../test/render-rules';
import { deliveryTier, ruleDeck } from '../../test/rule-fixtures';

const panel = () => screen.getByRole('region', { name: 'Test input' });
const status = () => within(panel()).getByRole('status');
const grid = () => screen.getByRole('grid');

async function typeInputs(
  user: ReturnType<typeof renderRules>['user'],
  values: Record<string, string>,
) {
  for (const [label, value] of Object.entries(values)) {
    const field = within(panel()).getByRole('textbox', { name: label });
    await user.clear(field);
    if (value !== '') await user.type(field, value);
  }
}

describe('TestPanel (story 6, FR-026)', () => {
  it('matches with First match, marks the row and lists its actions; an empty input matches nothing', async () => {
    const { user } = renderRules(ruleDeck, '/deck/d/rules/T');
    expect(
      within(panel())
        .getAllByRole('textbox')
        .map((t) => t.getAttribute('aria-label')),
    ).toEqual(['Distance (km)', 'Weight (kg)', 'Priority']);
    expect(status()).toHaveAttribute('aria-live', 'polite');
    await typeInputs(user, { 'Distance (km)': '5', 'Weight (kg)': '10', Priority: 'Express' });
    expect(status()).toHaveTextContent('Matched Row 1');
    expect(
      within(status())
        .getAllByRole('term')
        .map((t) => t.textContent),
    ).toEqual(['Vehicle', 'SLA', 'Surcharge']);
    expect(status()).toHaveTextContent('VehicleBikeSLA45 minSurcharge€4.00');
    const rows = within(grid()).getAllByRole('row').slice(2);
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    expect(within(grid()).getByRole('rowheader', { name: 'Row 1, matched' })).toBeInTheDocument();
    await typeInputs(user, { 'Weight (kg)': '' });
    expect(status()).toHaveTextContent('No row matches these inputs');
  });

  it('lists every matching row with Collect and warns with Unique', async () => {
    const collect = {
      ...ruleDeck,
      rules: { ...ruleDeck.rules, T: { ...deliveryTier, hitPolicy: 'collect' as const } },
    };
    const view = renderRules(collect, '/deck/d/rules/T');
    await typeInputs(view.user, { 'Distance (km)': '5', 'Weight (kg)': '10', Priority: 'Express' });
    expect(status()).toHaveTextContent('Matched 2 rows');
    expect(status()).toHaveTextContent('Row 1VehicleBike');
    expect(status()).toHaveTextContent('Row 3VehicleVan');
    const selected = within(grid())
      .getAllByRole('row')
      .filter((r) => r.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(2);
    view.unmount();

    const unique = {
      ...ruleDeck,
      rules: { ...ruleDeck.rules, T: { ...deliveryTier, hitPolicy: 'unique' as const } },
    };
    const again = renderRules(unique, '/deck/d/rules/T');
    await typeInputs(again.user, {
      'Distance (km)': '5',
      'Weight (kg)': '10',
      Priority: 'Express',
    });
    expect(status()).toHaveTextContent('2 rows match; Unique expects one (Rows 1 and 3)');
    await typeInputs(again.user, { 'Distance (km)': '15' });
    expect(status()).toHaveTextContent('Matched Row 3');
  });

  it('announces the result once typing pauses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { user } = renderRules(ruleDeck, '/deck/d/rules/T');
      await typeInputs(user, { 'Distance (km)': '30' });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(useUiStore.getState().announcement.text).toBe('No row matches these inputs');
    } finally {
      vi.useRealTimers();
    }
  });

  it('opened from a step, starts from its inputs and saves them as one undo step', async () => {
    const { user, doc, editor, ui } = renderRules(ruleDeck, '/deck/d/rules');
    act(() => {
      ui().setRuleTest({
        ruleId: 'T',
        values: { dist: '5', weight: '10', prio: 'Express' },
        from: { flowId: 'place', stepId: 'p2' },
      });
    });
    await user.click(screen.getByRole('link', { name: /Delivery tier/ }));
    expect(within(panel()).getByRole('textbox', { name: 'Priority' })).toHaveValue('Express');
    await typeInputs(user, { Priority: 'Standard' });
    expect(toJSON(doc).flows[0]?.steps[1]?.ruleInputs?.T?.prio).toBe('Express');
    await user.click(
      screen.getByRole('button', { name: 'Save as step inputs (Place order · Step 2)' }),
    );
    expect(toJSON(doc).flows[0]?.steps[1]?.ruleInputs).toEqual({
      T: { dist: '5', weight: '10', prio: 'Standard' },
    });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).flows[0]?.steps[1]?.ruleInputs?.T?.prio).toBe('Express');
  });

  it('keeps test values out of the deck, and offers no save when not opened from a step', async () => {
    const { user, doc } = renderRules(ruleDeck, '/deck/d/rules/T');
    const before = serializeDeck(toJSON(doc));
    await typeInputs(user, { 'Distance (km)': '12', Priority: 'Rush' });
    expect(serializeDeck(toJSON(doc))).toBe(before);
    expect(serializeDeck(toJSON(doc))).not.toContain('Rush');
    expect(screen.queryByRole('button', { name: /Save as step inputs/ })).not.toBeInTheDocument();
  });
});
