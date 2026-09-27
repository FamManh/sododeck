import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { renderRules } from '../../test/render-rules';
import { ruleDeck } from '../../test/rule-fixtures';

const usedIn = () => screen.getByRole('region', { name: 'Used in' });

describe('UsedIn (story 6, FR-028)', () => {
  it('lists steps with flow, number and route, and components by title', () => {
    renderRules(ruleDeck, '/deck/d/rules/T');
    expect(
      within(usedIn())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([
      'Place order · Step 2 · Order Service → Pricing Service',
      'Assign driver · Step 2 · Dispatch Service → Route Optimizer',
      'Pricing Service',
    ]);
  });

  it('says "Connection deleted" for a broken step', () => {
    const broken = { ...ruleDeck, edges: ruleDeck.edges.filter((e) => e.id !== 'dr') };
    renderRules(broken, '/deck/d/rules/T');
    expect(
      within(usedIn()).getByRole('button', { name: 'Assign driver · Step 2 · Connection deleted' }),
    ).toBeInTheDocument();
  });

  it('goes to the canvas with the flow shown and the step selected, or the component selected', async () => {
    const { user, path, ui } = renderRules(ruleDeck, '/deck/d/rules/T');
    await user.click(within(usedIn()).getByRole('button', { name: /^Assign driver · Step 2/ }));
    expect(path()).toBe('/deck/d');
    expect(ui().activeFlow).toEqual({ flowId: 'assign', stepId: 'a2', branchId: null });
    expect(
      screen.getByRole('heading', { name: /^Step 2 · Dispatch Service → Route Optimizer/ }),
    ).toBeInTheDocument();

    const again = renderRules(ruleDeck, '/deck/d/rules/T');
    await again.user.click(
      within(screen.getAllByRole('region', { name: 'Used in' }).at(-1) as HTMLElement).getByRole(
        'button',
        { name: 'Pricing Service' },
      ),
    );
    expect(again.ui().selection).toEqual({ nodes: ['p'], edges: [] });
  });

  it('says "Not used yet" without usage', () => {
    renderRules(
      deckOf({
        rules: { R: { title: 'Lonely', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
      }),
      '/deck/d/rules/R',
    );
    expect(within(usedIn()).getByText('Not used yet')).toBeInTheDocument();
  });
});
