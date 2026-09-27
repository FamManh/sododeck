import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createEditor,
  DeckEditError,
  fromJSON,
  getObject,
  observeDeck,
  toJSON,
  type DeckChange,
  type EditorOptions,
} from '../src';
import { expectValid, seqIds } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'client', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b' }],
  flows: [{ id: 'fl', title: 'F', steps: [{ id: 's', edge: 'e' }] }],
  rules: {
    R: {
      title: 'Tier',
      hitPolicy: 'first',
      inputs: [
        { id: 'in1', label: 'Weight' },
        { id: 'in2', label: 'Zone' },
      ],
      outputs: [{ id: 'out1', label: 'Carrier' }],
      rows: [{ id: 'r1', when: ['< 5', 'EU'], then: ['Post'] }],
    },
    Q: { title: 'Other', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
  },
};

function setup(options: EditorOptions = {}) {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc, { newId: seqIds(), ...options }) };
}

const step = (doc: ReturnType<typeof fromJSON>) => getObject(doc, 'flows', 'fl')?.steps[0];
const nodeRules = (doc: ReturnType<typeof fromJSON>) => getObject(doc, 'nodes', 'b')?.rules;
const STEP = { kind: 'step', flowId: 'fl', stepId: 's' } as const;
const NODE = { kind: 'node', id: 'b' } as const;

describe('attachRule / detachRule (FR-029, FR-030)', () => {
  it('attaches and detaches on a node, in order, clearing the field when empty', () => {
    const { doc, editor } = setup();
    editor.attachRule(NODE, 'R');
    editor.attachRule(NODE, 'Q');
    expect(nodeRules(doc)).toEqual(['R', 'Q']);
    editor.detachRule(NODE, 'R');
    expect(nodeRules(doc)).toEqual(['Q']);
    editor.detachRule(NODE, 'Q');
    expect(nodeRules(doc)).toBeUndefined();
    expectValid(doc);
  });

  it('attaches and detaches on a step', () => {
    const { doc, editor } = setup();
    editor.attachRule(STEP, 'R');
    expect(step(doc)?.rules).toEqual(['R']);
    editor.detachRule(STEP, 'R');
    expect(step(doc)?.rules).toBeUndefined();
    expectValid(doc);
  });

  it('refuses a double attach and a missing rule or host', () => {
    const { doc, editor } = setup();
    editor.attachRule(NODE, 'R');
    expect(() => {
      editor.attachRule(NODE, 'R');
    }).toThrow(expect.objectContaining({ code: 'invalid' }) as Error);
    expect(() => {
      editor.attachRule(STEP, 'nope');
    }).toThrow(expect.objectContaining({ code: 'missing-reference' }) as Error);
    expect(() => {
      editor.attachRule({ kind: 'node', id: 'zzz' }, 'R');
    }).toThrow(DeckEditError);
    expect(() => {
      editor.attachRule({ kind: 'step', flowId: 'fl', stepId: 'zzz' }, 'R');
    }).toThrow(DeckEditError);
    expect(nodeRules(doc)).toEqual(['R']);
  });

  it('does nothing when detaching a rule that is not attached', () => {
    const { editor } = setup();
    editor.detachRule(NODE, 'R');
    expect(editor.canUndo()).toBe(false);
  });

  it('removes the step sample inputs for the rule in the same transaction', () => {
    const { doc, editor } = setup();
    editor.attachRule(STEP, 'R');
    editor.attachRule(STEP, 'Q');
    editor.setRuleInputs('fl', 's', 'R', { in1: '3' });
    const events: DeckChange[] = [];
    const stop = observeDeck(doc, (c) => events.push(c));
    editor.detachRule(STEP, 'R');
    stop();
    expect(events).toHaveLength(1);
    expect(step(doc)?.rules).toEqual(['Q']);
    expect(step(doc)?.ruleInputs).toBeUndefined();
    expectValid(doc);
    editor.undo();
    expect(step(doc)?.rules).toEqual(['R', 'Q']);
    expect(step(doc)?.ruleInputs).toEqual({ R: { in1: '3' } });
  });

  it('is one undo step per op', () => {
    const { doc, editor } = setup({ captureTimeout: 10_000 });
    editor.attachRule(NODE, 'R');
    editor.attachRule(NODE, 'Q');
    editor.undo();
    expect(nodeRules(doc)).toEqual(['R']);
    editor.undo();
    expect(nodeRules(doc)).toBeUndefined();
  });
});

describe('setRuleInputs (FR-031)', () => {
  it('sets values, drops empty ones, and removes the key when nothing is left', () => {
    const { doc, editor } = setup();
    editor.attachRule(STEP, 'R');
    editor.setRuleInputs('fl', 's', 'R', { in1: '3', in2: '' });
    expect(step(doc)?.ruleInputs).toEqual({ R: { in1: '3' } });
    editor.setRuleInputs('fl', 's', 'R', { in1: '', in2: 'EU' });
    expect(step(doc)?.ruleInputs).toEqual({ R: { in2: 'EU' } });
    editor.setRuleInputs('fl', 's', 'R', { in2: '' });
    expect(step(doc)?.ruleInputs).toBeUndefined();
    expectValid(doc);
  });

  it('refuses inputs for a rule that is not attached, or an unknown column', () => {
    const { editor } = setup();
    expect(() => {
      editor.setRuleInputs('fl', 's', 'R', { in1: '3' });
    }).toThrow(expect.objectContaining({ code: 'missing-reference' }) as Error);
    editor.attachRule(STEP, 'R');
    expect(() => {
      editor.setRuleInputs('fl', 's', 'R', { out1: '3' });
    }).toThrow(expect.objectContaining({ code: 'missing-reference' }) as Error);
  });

  it('does nothing when the values are unchanged', () => {
    const { editor } = setup();
    editor.attachRule(STEP, 'R');
    editor.setRuleInputs('fl', 's', 'R', { in1: '3' });
    const before = JSON.stringify(toJSON(editor.doc));
    let changes = 0;
    const stop = observeDeck(editor.doc, () => changes++);
    editor.setRuleInputs('fl', 's', 'R', { in1: '3', in2: '' });
    stop();
    expect(changes).toBe(0);
    expect(JSON.stringify(toJSON(editor.doc))).toBe(before);
  });

  it('merges keyed typing into one undo step', () => {
    const { doc, editor } = setup({ captureTimeout: 10_000 });
    editor.attachRule(STEP, 'R');
    for (const v of ['1', '12', '123']) editor.setRuleInputs('fl', 's', 'R', { in1: v });
    expect(step(doc)?.ruleInputs).toEqual({ R: { in1: '123' } });
    editor.undo();
    expect(step(doc)?.ruleInputs).toBeUndefined();
    expect(step(doc)?.rules).toEqual(['R']);
  });

  it('reports changes through observeDeck with origin local', () => {
    const { doc, editor } = setup();
    const events: DeckChange[] = [];
    const stop = observeDeck(doc, (c) => events.push(c));
    editor.attachRule(STEP, 'R');
    editor.setRuleInputs('fl', 's', 'R', { in1: '3' });
    editor.attachRule(NODE, 'R');
    stop();
    expect(events.map((e) => e.origin)).toEqual(['local', 'local', 'local']);
    expect(events[0]?.changes).toEqual([
      {
        scope: 'flows',
        id: 'fl',
        child: { kind: 'step', id: 's' },
        kind: 'updated',
        keys: ['rules'],
      },
    ]);
    expect(events[1]?.changes[0]).toMatchObject({ child: { id: 's' }, keys: ['ruleInputs'] });
    expect(events[2]?.changes).toEqual([
      { scope: 'nodes', id: 'b', kind: 'updated', keys: ['rules'] },
    ]);
  });
});
