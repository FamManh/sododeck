import { createEditor } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { renderRules } from '../../test/render-rules';
import { ruleDeck } from '../../test/rule-fixtures';

describe('useRuleSync (story 4, spec edge case)', () => {
  it('falls back to the rule list and forgets the test when another tab removes the open rule', () => {
    const { doc, path, ui } = renderRules(ruleDeck, '/deck/d/rules/T');
    act(() => {
      ui().setRuleTestValue('dist', '5');
    });
    expect(ui().ruleTest?.ruleId).toBe('T');
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    createEditor(other).removeRule('T');
    act(() => {
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));
    });
    expect(path()).toBe('/deck/d/rules');
    expect(ui().ruleTest).toBeNull();
    expect(screen.getByText('Choose a decision table')).toBeInTheDocument();
  });

  it('falls back after deleting the open rule here', async () => {
    const { user, path } = renderRules(ruleDeck, '/deck/d/rules/P');
    await user.click(screen.getByRole('button', { name: 'Delete rule…' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('It isn’t used anywhere.');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(path()).toBe('/deck/d/rules');
  });
});
