import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { checkIntegrity, type IntegrityProblem } from '../src';
import { readExample } from './helpers';

const node = (id: string, extra: Partial<SododeckFile['nodes'][number]> = {}) => ({
  id,
  type: 'service' as const,
  title: id,
  ...extra,
});
const rule = {
  title: 'R',
  hitPolicy: 'first' as const,
  inputs: [{ id: 'in1', label: 'In' }],
  outputs: [],
  rows: [],
};

function problems(patch: Partial<SododeckFile>): IntegrityProblem[] {
  return checkIntegrity({ ...emptySododeckFile(), ...patch });
}

describe('checkIntegrity (FR-030/031, SC-008)', () => {
  it.each(['minimal', 'flow-and-rule', 'full'])('finds nothing in the %s example', async (name) => {
    expect(checkIntegrity(await readExample(`${name}.sododeck.json`))).toEqual([]);
  });

  it('edge → missing node', () => {
    expect(problems({ nodes: [node('a')], edges: [{ id: 'e', from: 'x', to: 'a' }] })).toEqual([
      {
        kind: 'missing-reference',
        object: { scope: 'edges', id: 'e' },
        field: 'from',
        target: 'x',
        targetType: 'node',
      },
    ]);
    expect(problems({ nodes: [node('a')], edges: [{ id: 'e', from: 'a', to: 'y' }] })).toEqual([
      expect.objectContaining({ field: 'to', target: 'y', targetType: 'node' }),
    ]);
  });

  it('step → missing edge', () => {
    expect(problems({ flows: [{ id: 'f', title: 'F', steps: [{ id: 's', edge: 'e' }] }] })).toEqual(
      [
        {
          kind: 'missing-reference',
          object: { scope: 'flows', id: 'f', child: { kind: 'step', id: 's' } },
          field: 'edge',
          target: 'e',
          targetType: 'edge',
        },
      ],
    );
  });

  it('node and step → missing rule', () => {
    expect(
      problems({
        nodes: [node('a'), node('b', { rules: ['R'] })],
        edges: [{ id: 'e', from: 'a', to: 'b' }],
        flows: [{ id: 'f', title: 'F', steps: [{ id: 's', edge: 'e', rules: ['Q'] }] }],
      }),
    ).toEqual([
      {
        kind: 'missing-reference',
        object: { scope: 'nodes', id: 'b' },
        field: 'rules',
        target: 'R',
        targetType: 'rule',
      },
      {
        kind: 'missing-reference',
        object: { scope: 'flows', id: 'f', child: { kind: 'step', id: 's' } },
        field: 'rules',
        target: 'Q',
        targetType: 'rule',
      },
    ]);
  });

  it('sample inputs for a rule not attached to the step (detached-rule-input)', () => {
    expect(
      problems({
        nodes: [node('a')],
        edges: [{ id: 'e', from: 'a', to: 'a' }],
        flows: [
          { id: 'f', title: 'F', steps: [{ id: 's', edge: 'e', ruleInputs: { R: { in1: '1' } } }] },
        ],
        rules: { R: rule },
      }),
    ).toEqual([
      {
        kind: 'detached-rule-input',
        object: { scope: 'flows', id: 'f', child: { kind: 'step', id: 's' } },
        field: 'ruleInputs.R',
        target: 'R',
        targetType: 'rule',
      },
    ]);
  });

  it('sample input for an unknown input column', () => {
    expect(
      problems({
        nodes: [node('a')],
        edges: [{ id: 'e', from: 'a', to: 'a' }],
        flows: [
          {
            id: 'f',
            title: 'F',
            steps: [
              { id: 's', edge: 'e', rules: ['R'], ruleInputs: { R: { in1: '1', in2: '2' } } },
            ],
          },
        ],
        rules: { R: rule },
      }),
    ).toEqual([
      {
        kind: 'missing-reference',
        object: { scope: 'flows', id: 'f', child: { kind: 'step', id: 's' } },
        field: 'ruleInputs.R.in2',
        target: 'in2',
        targetType: 'rule-column',
      },
    ]);
  });

  it('sticky → missing anchor, and an anchor matching two objects', () => {
    expect(
      problems({
        nodes: [node('x')],
        edges: [{ id: 'x', from: 'x', to: 'x' }],
        stickies: [
          { id: 's1', text: '', anchor: 'gone' },
          { id: 's2', text: '', anchor: 'x' },
        ],
      }),
    ).toEqual([
      {
        kind: 'missing-reference',
        object: { scope: 'stickies', id: 's1' },
        field: 'anchor',
        target: 'gone',
        targetType: 'object',
      },
      {
        kind: 'ambiguous-anchor',
        object: { scope: 'stickies', id: 's2' },
        field: 'anchor',
        target: 'x',
        targetType: 'object',
      },
    ]);
  });

  it('accepts sticky anchors on steps, rules, flows, views and features', () => {
    expect(
      problems({
        nodes: [node('a')],
        edges: [{ id: 'e', from: 'a', to: 'a' }],
        views: [{ id: 'v', type: 'system', title: 'V' }],
        features: [{ id: 'feat', title: 'F' }],
        flows: [{ id: 'f', title: 'F', steps: [{ id: 's', edge: 'e' }] }],
        rules: { R: rule },
        stickies: ['s', 'R', 'f', 'v', 'feat', 'e'].map((anchor, i) => ({
          id: `n${String(i)}`,
          text: '',
          anchor,
        })),
      }),
    ).toEqual([]);
  });

  it('view → missing node or feature', () => {
    expect(
      problems({
        nodes: [node('a')],
        views: [
          {
            id: 'v',
            type: 'feature',
            title: 'V',
            feature: 'F',
            includes: ['a', 'b'],
            positions: { c: { x: 0, y: 0 } },
          },
        ],
      }),
    ).toEqual([
      {
        kind: 'missing-reference',
        object: { scope: 'views', id: 'v' },
        field: 'feature',
        target: 'F',
        targetType: 'feature',
      },
      {
        kind: 'missing-reference',
        object: { scope: 'views', id: 'v' },
        field: 'includes',
        target: 'b',
        targetType: 'node',
      },
      {
        kind: 'missing-reference',
        object: { scope: 'views', id: 'v' },
        field: 'positions',
        target: 'c',
        targetType: 'node',
      },
    ]);
  });

  it('flow → missing feature', () => {
    expect(problems({ flows: [{ id: 'f', title: 'F', feature: 'x', steps: [] }] })).toEqual([
      {
        kind: 'missing-reference',
        object: { scope: 'flows', id: 'f' },
        field: 'feature',
        target: 'x',
        targetType: 'feature',
      },
    ]);
  });

  it('node → missing group or parent; group → missing parent', () => {
    expect(
      problems({
        nodes: [node('a', { group: 'g', parent: 'p' })],
        groups: [{ id: 'h', title: 'H', parent: 'q' }],
      }),
    ).toEqual([
      {
        kind: 'missing-reference',
        object: { scope: 'nodes', id: 'a' },
        field: 'group',
        target: 'g',
        targetType: 'group',
      },
      {
        kind: 'missing-reference',
        object: { scope: 'nodes', id: 'a' },
        field: 'parent',
        target: 'p',
        targetType: 'node',
      },
      {
        kind: 'missing-reference',
        object: { scope: 'groups', id: 'h' },
        field: 'parent',
        target: 'q',
        targetType: 'group',
      },
    ]);
  });

  it('reports each group cycle and node parent cycle once, on its smallest id', () => {
    expect(
      problems({
        groups: [
          { id: 'g3', title: 'G', parent: 'g1' },
          { id: 'g1', title: 'G', parent: 'g2' },
          { id: 'g2', title: 'G', parent: 'g3' },
          { id: 'g4', title: 'G', parent: 'g3' },
          { id: 'self', title: 'G', parent: 'self' },
        ],
        nodes: [node('b', { parent: 'a' }), node('a', { parent: 'b' }), node('c', { parent: 'a' })],
      }),
    ).toEqual([
      {
        kind: 'cycle',
        object: { scope: 'groups', id: 'g1' },
        field: 'parent',
        target: 'g2',
        targetType: 'group',
      },
      {
        kind: 'cycle',
        object: { scope: 'groups', id: 'self' },
        field: 'parent',
        target: 'self',
        targetType: 'group',
      },
      {
        kind: 'cycle',
        object: { scope: 'nodes', id: 'a' },
        field: 'parent',
        target: 'b',
        targetType: 'node',
      },
    ]);
  });
});
