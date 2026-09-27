import { checkSemanticRules, emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, DeckEditError, fromJSON, getRule, toJSON, type DeckDoc } from '../src';
import { expectValid, seqIds } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [{ id: 'a', type: 'client', title: 'A' }],
  edges: [{ id: 'e', from: 'a', to: 'a' }],
  flows: [
    {
      id: 'fl',
      title: 'F',
      steps: [{ id: 's', edge: 'e', rules: ['R'], ruleInputs: { R: { in1: '3', in2: 'EU' } } }],
    },
  ],
  rules: {
    R: {
      title: 'Carrier',
      hitPolicy: 'first',
      inputs: [
        { id: 'in1', label: 'Weight' },
        { id: 'in2', label: 'Zone' },
      ],
      outputs: [{ id: 'out1', label: 'Carrier' }],
      rows: [
        { id: 'r1', when: ['< 5', 'EU'], then: ['Post'] },
        { id: 'r2', when: ['', ''], then: ['Truck'] },
      ],
    },
  },
};

function setup() {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

/** Every rule op keeps the tables valid (S1: one cell per column), checked after each call. */
function expectClean(doc: DeckDoc): void {
  expectValid(doc);
  expect(checkSemanticRules(toJSON(doc))).toEqual([]);
}

const cells = (doc: DeckDoc) => getRule(doc, 'R')?.rows.map((r) => [...r.when, '|', ...r.then]);

describe('rule operations (FR-018)', () => {
  it('adds a rule with defaults', () => {
    const { doc, editor } = setup();
    const id = editor.addRule({ title: 'New' });
    expect(id).toMatch(/^rule-/);
    expect(getRule(doc, id)).toEqual({
      title: 'New',
      hitPolicy: 'first',
      inputs: [],
      outputs: [],
      rows: [],
    });
    expectClean(doc);
  });

  it('adds a full rule with an explicit id, and refuses one with bad cell counts or duplicate ids', () => {
    const { doc, editor } = setup();
    const rule = {
      title: 'Full',
      hitPolicy: 'collect' as const,
      inputs: [{ id: 'c1', label: 'In' }],
      outputs: [],
      rows: [{ id: 'x', when: ['1'], then: [] }],
    };
    expect(editor.addRule({ id: 'Full', ...rule })).toBe('Full');
    expect(getRule(doc, 'Full')).toEqual(rule);
    expect(() => editor.addRule({ id: 'R', title: 'Taken' })).toThrow(DeckEditError);
    expect(() => editor.addRule({ ...rule, rows: [{ id: 'x', when: [], then: [] }] })).toThrow(
      DeckEditError,
    );
    expect(() =>
      editor.addRule({ ...rule, outputs: [{ id: 'c1', label: 'Out' }], rows: [] }),
    ).toThrow(expect.objectContaining({ code: 'duplicate-id' }) as Error);
    expectClean(doc);
  });

  it('updates title, description and hit policy, and refuses columns and rows', () => {
    const { doc, editor } = setup();
    editor.updateRule('R', { title: 'Carrier choice', description: 'Why', hitPolicy: 'unique' });
    expect(getRule(doc, 'R')).toMatchObject({
      title: 'Carrier choice',
      description: 'Why',
      hitPolicy: 'unique',
    });
    editor.updateRule('R', { description: null });
    expect(getRule(doc, 'R')).not.toHaveProperty('description');
    expect(() => {
      // @ts-expect-error columns are edited with the column operations
      editor.updateRule('R', { inputs: [] });
    }).toThrow(DeckEditError);
    expect(() => {
      editor.updateRule('R', { title: '' });
    }).toThrow(DeckEditError);
    expectClean(doc);
  });

  it('adds a column with an empty cell at its index in every row', () => {
    const { doc, editor } = setup();
    const col = editor.addRuleColumn('R', 'inputs', 'Express', 1);
    expect(getRule(doc, 'R')?.inputs.map((c) => c.id)).toEqual(['in1', col, 'in2']);
    expect(cells(doc)).toEqual([
      ['< 5', '', 'EU', '|', 'Post'],
      ['', '', '', '|', 'Truck'],
    ]);
    const out = editor.addRuleColumn('R', 'outputs', 'Cost');
    expect(getRule(doc, 'R')?.outputs.map((c) => c.id)).toEqual(['out1', out]);
    expect(cells(doc)?.[0]).toEqual(['< 5', '', 'EU', '|', 'Post', '']);
    expect(() => editor.addRuleColumn('R', 'inputs', '')).toThrow(DeckEditError);
    expectClean(doc);
  });

  it('renames and moves a column, moving its cells', () => {
    const { doc, editor } = setup();
    editor.renameRuleColumn('R', 'in2', 'Region');
    editor.moveRuleColumn('R', 'in2', 0);
    expect(getRule(doc, 'R')?.inputs).toEqual([
      { id: 'in2', label: 'Region' },
      { id: 'in1', label: 'Weight' },
    ]);
    expect(cells(doc)).toEqual([
      ['EU', '< 5', '|', 'Post'],
      ['', '', '|', 'Truck'],
    ]);
    expectClean(doc);
  });

  it('removes a column, its cells and the matching sample inputs on steps', () => {
    const { doc, editor } = setup();
    const result = editor.removeRuleColumn('R', 'in1');
    expect(getRule(doc, 'R')?.inputs.map((c) => c.id)).toEqual(['in2']);
    expect(cells(doc)).toEqual([
      ['EU', '|', 'Post'],
      ['', '|', 'Truck'],
    ]);
    expect(toJSON(doc).flows[0]?.steps[0]?.ruleInputs).toEqual({ R: { in2: 'EU' } });
    expect(result).toEqual({
      removed: [{ scope: 'rules', id: 'R', child: { kind: 'column', id: 'in1' } }],
      updated: [{ scope: 'flows', id: 'fl', child: { kind: 'step', id: 's' } }],
      broken: [],
    });
    editor.removeRuleColumn('R', 'out1');
    expect(cells(doc)).toEqual([
      ['EU', '|'],
      ['', '|'],
    ]);
    expectClean(doc);
  });

  it('adds rows, filling missing cells, and refuses too many cells', () => {
    const { doc, editor } = setup();
    const r3 = editor.addRuleRow('R', { when: ['> 20'] });
    const r0 = editor.addRuleRow('R', undefined, 0);
    expect(getRule(doc, 'R')?.rows.map((r) => r.id)).toEqual([r0, 'r1', 'r2', r3]);
    expect(cells(doc)?.[0]).toEqual(['', '', '|', '']);
    expect(cells(doc)?.[3]).toEqual(['> 20', '', '|', '']);
    expect(() => editor.addRuleRow('R', { then: ['a', 'b'] })).toThrow(DeckEditError);
    expectClean(doc);
  });

  it('sets cells, moves and removes rows', () => {
    const { doc, editor } = setup();
    editor.setRuleCell('R', 'r2', 'in2', 'US');
    editor.setRuleCell('R', 'r2', 'out1', 'Plane');
    editor.moveRuleRow('R', 'r2', 0);
    expect(cells(doc)).toEqual([
      ['', 'US', '|', 'Plane'],
      ['< 5', 'EU', '|', 'Post'],
    ]);
    editor.removeRuleRow('R', 'r1');
    expect(getRule(doc, 'R')?.rows.map((r) => r.id)).toEqual(['r2']);
    expect(() => {
      editor.setRuleCell('R', 'r2', 'nope', 'x');
    }).toThrow(DeckEditError);
    expect(() => {
      editor.setRuleCell('R', 'nope', 'in1', 'x');
    }).toThrow(DeckEditError);
    expectClean(doc);
  });

  it('refuses operations on a missing rule', () => {
    const { editor } = setup();
    expect(() => editor.addRuleRow('nope')).toThrow(
      expect.objectContaining({ code: 'not-found' }) as Error,
    );
    expect(() => editor.addRuleColumn('nope', 'inputs', 'x')).toThrow(DeckEditError);
  });
});
