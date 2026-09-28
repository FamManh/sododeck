import { toJSON } from '@sododeck/model';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { renderRules } from '../../test/render-rules';
import { ruleDeck } from '../../test/rule-fixtures';

describe('RuleList (story 4, FR-019)', () => {
  it('lists every rule with "<rows> rows · used in <n> steps" and marks the open one', async () => {
    const { user, path } = renderRules(ruleDeck, '/deck/d/rules/T');
    const nav = screen.getByRole('navigation', { name: 'Decision tables' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Delivery tier5 rows · used in 2 steps',
      'Reattempt policy1 row · used in 0 steps',
    ]);
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links[1]).not.toHaveAttribute('aria-current');
    expect(
      screen.getByText(/Rules are shared across the deck. Attach one to any flow step/),
    ).toBeInTheDocument();
    await user.click(links[1] as HTMLElement);
    expect(path()).toBe('/deck/d/rules/P');
    expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveValue('Reattempt policy');
  });

  it('marks rules that have problems with the glyph (015 FR-023)', async () => {
    renderRules(
      deckOf({
        rules: {
          R: { title: 'No fallback', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
        },
      }),
    );
    const link = screen.getByRole('link', { name: /No fallback/ });
    expect(await within(link).findByRole('img', { name: '1 problem' })).toHaveAttribute(
      'title',
      'Rule without catch-all',
    );
  });

  it('shows an empty state without rules, and New creates "Untitled rule" with its name focused', async () => {
    const { user, doc, path } = renderRules(deckOf({}));
    expect(screen.getByText('No decision tables yet', { selector: 'nav p' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New rule' }));
    const [id] = Object.keys(toJSON(doc).rules);
    expect(toJSON(doc).rules).toEqual({
      [id ?? '']: { title: 'Untitled rule', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
    });
    expect(path()).toBe(`/deck/d/rules/${id ?? ''}`);
    expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveFocus();
  });
});
