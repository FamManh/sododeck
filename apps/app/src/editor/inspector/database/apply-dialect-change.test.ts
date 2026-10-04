import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { planDialectChange } from '../../../db/dialect-change';
import { shopDeck } from '../../../db/fixtures/shop';
import { applyDialectChange } from './apply-dialect-change';

function open() {
  const doc = fromJSON(shopDeck('postgres'));
  const editor = createEditor(doc, { captureTimeout: 0 });
  return { editor, deck: () => toJSON(doc) };
}

describe('applyDialectChange', () => {
  it('writes the dialect and every change in one undo step', () => {
    const { editor, deck } = open();
    const before = deck();
    const plan = planDialectChange(before, 'mysql');
    expect(plan.changes.length).toBeGreaterThan(0);
    const message = applyDialectChange(editor, plan);
    expect(message).toBe(`Converted ${String(plan.changes.length)} columns to MySQL`);
    const after = deck();
    expect(after.dialect).toBe('mysql');
    expect(after).not.toEqual(before);
    expect(editor.undo()).toBe(true);
    expect(deck()).toEqual(before);
  });

  it('only sets the dialect when nothing converts', () => {
    const { editor, deck } = open();
    const plan = { from: 'postgres' as const, to: 'generic' as const, changes: [], kept: [] };
    const message = applyDialectChange(editor, plan);
    expect(message).toBe('Dialect set to Generic');
    expect(deck().dialect).toBeUndefined();
    expect(editor.undo()).toBe(true);
    expect(deck().dialect).toBe('postgres');
  });
});
