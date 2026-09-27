import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRules } from '../../test/render-rules';
import { ruleDeck } from '../../test/rule-fixtures';

const checks = () => screen.getByRole('region', { name: 'Checks' });

describe('RuleChecks (story 6, FR-027)', () => {
  it('warns without a catch-all row, and confirms one once added', async () => {
    const { user, editor } = renderRules(ruleDeck, '/deck/d/rules/T');
    expect(checks()).toHaveTextContent('No catch-all row — some inputs match nothing');
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    expect(checks()).toHaveTextContent('Has a catch-all row');
    expect(checks()).not.toHaveTextContent('No catch-all row');
    act(() => {
      editor().undo();
    });
    expect(checks()).toHaveTextContent('No catch-all row');
  });

  it('explains each hit policy in one line', () => {
    const { editor } = renderRules(ruleDeck, '/deck/d/rules/T');
    expect(checks()).toHaveTextContent('Row order decides the winner');
    act(() => {
      editor().updateRule('T', { hitPolicy: 'unique' });
    });
    expect(checks()).toHaveTextContent('Only one row may match');
    act(() => {
      editor().updateRule('T', { hitPolicy: 'collect' });
    });
    expect(checks()).toHaveTextContent('Every matching row applies');
  });
});
