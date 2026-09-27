import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRules } from '../../test/render-rules';
import { ruleDeck } from '../../test/rule-fixtures';

const rule = (doc: Parameters<typeof toJSON>[0]) => toJSON(doc).rules.T;

describe('RuleHeader (story 4, FR-020)', () => {
  it('renames the rule and refuses an empty name', async () => {
    const { user, doc } = renderRules(ruleDeck, '/deck/d/rules/T');
    const name = screen.getByRole('textbox', { name: 'Rule name' });
    await user.clear(name);
    await user.keyboard('{Enter}');
    expect(screen.getByText('Rule name can’t be empty.')).toBeInTheDocument();
    expect(rule(doc)?.title).toBe('Delivery tier');
    await user.type(name, 'Delivery tiers{Enter}');
    expect(rule(doc)?.title).toBe('Delivery tiers');
    const nav = screen.getByRole('navigation', { name: 'Decision tables' });
    expect(within(nav).getByRole('link', { name: /Delivery tiers/ })).toBeInTheDocument();
  });

  it('edits the description with Write / Preview', async () => {
    const { user, doc } = renderRules(ruleDeck, '/deck/d/rules/T');
    const text = screen.getByRole('textbox', { name: 'Description' });
    await user.clear(text);
    await user.type(text, 'Uses `distance`.');
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(screen.getByRole('region', { name: 'Description preview' })).toHaveTextContent(
      'Uses distance.',
    );
    expect(rule(doc)?.description).toBe('Uses `distance`.');
  });

  it('changes the hit policy, and the checks explain it', async () => {
    const { user, doc, editor } = renderRules(ruleDeck, '/deck/d/rules/T');
    const checks = screen.getByRole('region', { name: 'Checks' });
    expect(checks).toHaveTextContent('Row order decides the winner');
    const policy = screen.getByRole('combobox', { name: 'Hit policy' });
    expect(policy).toHaveValue('First match');
    await user.clear(policy);
    await user.type(policy, 'uni');
    await user.keyboard('{Enter}');
    expect(rule(doc)?.hitPolicy).toBe('unique');
    expect(checks).toHaveTextContent('Only one row may match');
    await user.clear(policy);
    await user.type(policy, 'coll');
    await user.keyboard('{Enter}');
    expect(checks).toHaveTextContent('Every matching row applies');
    act(() => {
      editor().undo();
    });
    expect(rule(doc)?.hitPolicy).toBe('unique');
  });
});
