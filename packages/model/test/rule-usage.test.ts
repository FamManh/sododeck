import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, fromJSON, ruleUsage, toJSON } from '../src';
import { seqIds } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'client', title: 'A' },
    { id: 'b', type: 'service', title: 'B', rules: ['R'] },
    { id: 'c', type: 'service', title: 'C' },
    { id: 'd', type: 'database', title: 'D', rules: ['Q', 'R'] },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
    { id: 'bd', from: 'b', to: 'd' },
  ],
  flows: [
    {
      id: 'f1',
      title: 'Place order',
      branches: [
        { id: 'ok', label: 'ok', condition: 'paid' },
        { id: 'ko', label: 'ko', condition: 'failed' },
      ],
      steps: [
        { id: 's1', edge: 'ab' },
        { id: 's2', edge: 'bc', rules: ['R'] },
        { id: 's3', edge: 'bd', branch: 'ok' },
        { id: 's4', edge: 'bd', branch: 'ko', rules: ['Q', 'R'] },
      ],
    },
    {
      id: 'f2',
      title: 'Assign driver',
      steps: [
        { id: 't1', edge: 'gone', rules: ['R'] },
        { id: 't2', edge: 'ab' },
      ],
    },
  ],
  rules: {
    R: {
      title: 'Tier',
      hitPolicy: 'first',
      inputs: [{ id: 'in1', label: 'Weight' }],
      outputs: [],
      rows: [],
    },
    Q: { title: 'Other', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
  },
};

describe('ruleUsage (FR-019, FR-028)', () => {
  it('lists steps in flow order with derived numbers (including branches), and nodes', () => {
    expect(ruleUsage(deck, 'R')).toEqual({
      steps: [
        { flowId: 'f1', stepId: 's2', number: '2', from: 'b', to: 'c', broken: false },
        { flowId: 'f1', stepId: 's4', number: '3b', from: 'b', to: 'd', broken: false },
        { flowId: 'f2', stepId: 't1', number: '1', from: null, to: null, broken: true },
      ],
      nodes: ['b', 'd'],
    });
    expect(ruleUsage(deck, 'Q')).toEqual({
      steps: [{ flowId: 'f1', stepId: 's4', number: '3b', from: 'b', to: 'd', broken: false }],
      nodes: ['d'],
    });
  });

  it('is empty for an unused or unknown rule', () => {
    expect(ruleUsage({ ...deck, flows: [], nodes: [] }, 'R')).toEqual({ steps: [], nodes: [] });
    expect(ruleUsage(deck, 'nope')).toEqual({ steps: [], nodes: [] });
  });

  it('does not change when the rule or a column is renamed', () => {
    const doc = fromJSON(deck);
    const editor = createEditor(doc, { newId: seqIds() });
    const before = ruleUsage(toJSON(doc), 'R');
    editor.updateRule('R', { title: 'Renamed' });
    editor.renameRuleColumn('R', 'in1', 'Mass');
    expect(ruleUsage(toJSON(doc), 'R')).toEqual(before);
  });
});
