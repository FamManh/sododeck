import { readFile } from 'node:fs/promises';

import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { checkDeck, type Problem } from '../src';
import { readExample } from './helpers';

type NodeData = SododeckFile['nodes'][number];
const node = (id: string, extra: Partial<NodeData> = {}): NodeData => ({
  id,
  type: 'service',
  title: id.toUpperCase(),
  ...extra,
});
const edge = (id: string, from: string, to: string, label?: string) =>
  label === undefined ? { id, from, to } : { id, from, to, label };
const anyRow = (id: string) => ({ id, when: [''], then: ['x'] });
const rule = (title: string, rows = [anyRow('r1')]) => ({
  title,
  hitPolicy: 'first' as const,
  inputs: [{ id: 'in1', label: 'In' }],
  outputs: [{ id: 'out1', label: 'Out' }],
  rows,
});

function deck(patch: Partial<SododeckFile>): SododeckFile {
  return { ...emptySododeckFile(), ...patch };
}
const kinds = (file: SododeckFile) => checkDeck(file).list.map((p) => p.kind);
const only = (file: SododeckFile): Problem => {
  const { list } = checkDeck(file);
  expect(list).toHaveLength(1);
  const [first] = list;
  if (first === undefined) throw new Error('no problem');
  return first;
};

/** a → b → c, all connected. */
const chain = () => ({
  nodes: [node('a'), node('b'), node('c')],
  edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')],
});

describe('checkDeck (015)', () => {
  describe('bundled decks (SC-001)', () => {
    it('finds nothing in the minimal example or an empty deck', async () => {
      expect(checkDeck(await readExample('minimal.sododeck.json')).total).toBe(0);
      expect(checkDeck(emptySododeckFile())).toEqual({ list: [], total: 0, byObject: new Map() });
    });

    // These examples contain real problems (a request that returns to the gateway breaks the
    // chain under 006's rule, rules without a catch-all row); the list must name exactly those.
    it('lists exactly the known problems of the richer examples', async () => {
      const list = async (name: string) =>
        checkDeck(await readExample(`${name}.sododeck.json`)).list.map((p) => p.kind);
      expect(await list('flow-and-rule')).toEqual(['broken-chain', 'rule-without-catch-all']);
      expect(await list('full')).toEqual([
        'broken-chain',
        'incomplete-flow',
        'rule-without-catch-all',
        'rule-without-catch-all',
      ]);
    });

    it('lists exactly the known problems of the 008 logistics deck', async () => {
      const url = new URL(
        '../../../specs/008-inspector-rules/screens/logistics.sododeck.json',
        import.meta.url,
      );
      const file = JSON.parse(await readFile(url, 'utf8')) as SododeckFile;
      expect(checkDeck(file).list.map((p) => p.detail)).toEqual([
        "Place order · step 4 doesn't continue from step 3",
        "Place order · step 5 doesn't continue from step 4",
        'Delivery tier · some inputs match no row',
        'Reattempt policy · some inputs match no row',
        "Reattempt policy · 1 cell can't be read",
      ]);
    });
  });

  describe('components without connections', () => {
    // Founder decision (2026-09-28): a diagram may hold components that are not connected yet,
    // or never will be; that is not a problem to report.
    it('never reports a component with no connections', () => {
      expect(
        kinds(deck({ ...chain(), nodes: [...chain().nodes, node('x', { title: 'Legacy' })] })),
      ).toEqual([]);
      expect(kinds(deck({ nodes: [node('a'), node('b'), node('c')] }))).toEqual([]);
    });
  });

  describe('card size out of range (017, research R11)', () => {
    it('reports a node with an out-of-range size, targeting the component', () => {
      const file = deck({
        nodes: [node('a', { title: 'API Gateway', size: { width: 900, height: 40 } })],
      });
      const problem = only(file);
      expect(problem.kind).toBe('card-size-out-of-range');
      expect(problem.target).toEqual({ type: 'node', id: 'a' });
      expect(problem.detail).toBe(
        'API Gateway has a size of 900 × 40; allowed 120 × 44 to 800 × 600',
      );
    });

    it('reports nothing for in-range sizes, absent sizes, or exactly the limits', () => {
      const file = deck({
        nodes: [
          node('a', { size: { width: 200, height: 72 } }),
          node('b'),
          node('c', { size: { width: 120, height: 44 } }),
          node('d', { size: { width: 800, height: 600 } }),
        ],
      });
      expect(kinds(file)).toEqual([]);
    });
  });

  describe('duplicate connections', () => {
    it('reports copies with the same source, target and label once, with the count', () => {
      const file = deck({
        nodes: [node('a', { title: 'API Gateway' }), node('b', { title: 'Tracking' })],
        edges: [edge('e1', 'a', 'b', 'GPS  stream'), edge('e2', 'a', 'b', ' gps stream ')],
      });
      expect(only(file)).toMatchObject({
        kind: 'duplicate-connection',
        detail: 'API Gateway → Tracking appears twice',
        target: { type: 'edges', ids: ['e1', 'e2'] },
      });
      file.edges.push(edge('e3', 'a', 'b', 'gps stream'));
      expect(only(file).detail).toBe('API Gateway → Tracking appears 3 times');
    });

    it('treats an empty label like a missing one', () => {
      expect(
        kinds(
          deck({
            nodes: [node('a'), node('b')],
            edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'b', ' ')],
          }),
        ),
      ).toEqual(['duplicate-connection']);
    });

    it('ignores opposite directions, different labels and self-loops', () => {
      expect(
        kinds(
          deck({
            nodes: [node('a'), node('b')],
            edges: [
              edge('e1', 'a', 'b'),
              edge('e2', 'b', 'a'),
              edge('e3', 'a', 'b', 'other'),
              edge('e4', 'a', 'a'),
              edge('e5', 'a', 'a'),
            ],
          }),
        ),
      ).toEqual([]);
    });
  });

  describe('flows', () => {
    it('reports a step whose connection was deleted, and no broken chain after it', () => {
      const p = only(
        deck({
          ...chain(),
          flows: [
            {
              id: 'f',
              title: 'Proof of delivery',
              steps: [
                { id: 's1', edge: 'ab' },
                { id: 's2', edge: 'gone' },
                { id: 's3', edge: 'ab' },
              ],
            },
          ],
        }),
      );
      expect(p).toMatchObject({
        kind: 'step-without-connection',
        detail: 'Proof of delivery · step 2 used a deleted connection',
        target: { type: 'flow', flowId: 'f', stepId: 's2' },
        order: 2,
      });
    });

    it('reports a broken chain with the previous step number', () => {
      const p = only(
        deck({
          ...chain(),
          flows: [
            {
              id: 'f',
              title: 'Failed delivery',
              steps: [
                { id: 's1', edge: 'bc' },
                { id: 's2', edge: 'ab' },
              ],
            },
          ],
        }),
      );
      expect(p).toMatchObject({
        kind: 'broken-chain',
        title: 'Broken flow',
        detail: "Failed delivery · step 2 doesn't continue from step 1",
        target: { type: 'flow', flowId: 'f', stepId: 's2' },
      });
    });

    it('reports incomplete flows: no steps, empty branch fields, unknown branch', () => {
      expect(
        only(deck({ ...chain(), flows: [{ id: 'f', title: 'Refund', steps: [] }] })),
      ).toMatchObject({
        kind: 'incomplete-flow',
        detail: 'Refund has no steps',
      });
      const branched = deck({
        ...chain(),
        flows: [
          {
            id: 'f',
            title: 'Pay',
            branches: [
              { id: 'b1', label: 'ok', condition: 'paid' },
              { id: 'b2', label: ' ', condition: '' },
            ],
            steps: [
              { id: 's1', edge: 'ab' },
              { id: 's2', edge: 'bc', branch: 'b1' },
              { id: 's3', edge: 'bc', branch: 'b2' },
            ],
          },
        ],
      });
      expect(checkDeck(branched).list.map((p) => p.detail)).toEqual([
        'Pay · branch b has no condition',
        'Pay · branch b has no label',
      ]);
      const unknown = only(
        deck({
          ...chain(),
          flows: [{ id: 'f', title: 'Pay', steps: [{ id: 's1', edge: 'ab', branch: 'zz' }] }],
        }),
      );
      expect(unknown).toMatchObject({
        kind: 'incomplete-flow',
        detail: 'Pay · a step belongs to a branch that no longer exists',
      });
    });

    it('reports overlapping branch conditions once per group, not for empty ones', () => {
      const file = deck({
        ...chain(),
        flows: [
          {
            id: 'f',
            title: 'Place order',
            branches: [
              { id: 'b1', label: 'A', condition: 'Paid' },
              { id: 'b2', label: 'B', condition: 'unpaid' },
              { id: 'b3', label: 'C', condition: '  paid ' },
            ],
            steps: [{ id: 's1', edge: 'ab' }],
          },
        ],
      });
      expect(only(file)).toMatchObject({
        kind: 'overlapping-conditions',
        detail: 'Place order · branches a and c both say "paid"',
        target: { type: 'flow', flowId: 'f', branchIds: ['b1', 'b3'] },
      });
    });
  });

  describe('rules', () => {
    it('reports a missing rule on a component and on a step', () => {
      const file = deck({
        ...chain(),
        nodes: [node('a', { title: 'Order Service', rules: ['R'] }), node('b'), node('c')],
        flows: [{ id: 'f', title: 'Ship', steps: [{ id: 's1', edge: 'ab', rules: ['Q'] }] }],
      });
      expect(checkDeck(file).list.map((p) => [p.kind, p.detail])).toEqual([
        ['missing-rule', 'Order Service uses a rule that was deleted'],
        ['missing-rule', 'Ship · step 1 uses a rule that was deleted'],
      ]);
    });

    it('reports a rule without a catch-all row and a rule with invalid cells', () => {
      const file = deck({
        ...chain(),
        rules: {
          R: rule('Delivery tier', [{ id: 'r1', when: ['< 5'], then: ['x'] }]),
          S: rule('Sizes', [{ id: 'r1', when: ['< <'], then: ['x'] }, anyRow('r2')]),
        },
      });
      expect(checkDeck(file).list.map((p) => [p.kind, p.detail, p.target])).toEqual([
        [
          'rule-without-catch-all',
          'Delivery tier · some inputs match no row',
          { type: 'rule', ruleId: 'R' },
        ],
        ['invalid-rule-cells', "Sizes · 1 cell can't be read", { type: 'rule', ruleId: 'S' }],
      ]);
    });
  });

  describe('broken references', () => {
    it('reports a sticky anchor, a group parent and a parent cycle', () => {
      const file = deck({
        ...chain(),
        groups: [
          { id: 'g1', title: 'Core', parent: 'gone' },
          { id: 'g2', title: 'X', parent: 'g3' },
          { id: 'g3', title: 'Y', parent: 'g2' },
        ],
        stickies: [{ id: 'n1', text: '\nCheck SLA\nmore', anchor: 'missing' }],
      });
      expect(checkDeck(file).list.map((p) => p.detail)).toEqual([
        'Sticky "Check SLA" points to something that was deleted',
        'Group "Core" points to a group that was deleted',
        'Group "X" is inside itself',
      ]);
    });

    it('does not double-report step edges and branches', () => {
      const file = deck({
        ...chain(),
        flows: [{ id: 'f', title: 'F', steps: [{ id: 's1', edge: 'gone', branch: 'zz' }] }],
      });
      expect(kinds(file)).toEqual(['incomplete-flow']);
    });
  });

  describe('order, keys and index', () => {
    const messy = () =>
      deck({
        nodes: [node('a'), node('b'), node('z', { title: 'Zeta' }), node('y', { title: 'alpha' })],
        edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')],
        flows: [{ id: 'f', title: 'F', steps: [{ id: 's1', edge: 'gone' }] }],
        rules: { R: rule('R', []) },
      });

    it('sorts by kind, then object title', () => {
      expect(checkDeck(messy()).list.map((p) => `${p.kind}/${p.objectTitle}`)).toEqual([
        'duplicate-connection/A',
        'step-without-connection/F',
        'rule-without-catch-all/R',
      ]);
    });

    it('keeps keys stable across calls and unrelated renames', () => {
      const before = checkDeck(messy()).list.map((p) => p.key);
      const renamed = messy();
      renamed.rules.R = rule('Renamed', []);
      expect(checkDeck(messy()).list.map((p) => p.key)).toEqual(before);
      expect(new Set(checkDeck(renamed).list.map((p) => p.key))).toEqual(new Set(before));
    });

    it('indexes problems by every object they name', () => {
      const result = checkDeck(messy());
      expect(result.total).toBe(result.list.length);
      expect(result.byObject.get('e1')?.map((p) => p.kind)).toEqual(['duplicate-connection']);
      expect(result.byObject.get('e2')?.map((p) => p.kind)).toEqual(['duplicate-connection']);
      expect(result.byObject.has('z')).toBe(false);
      expect(result.byObject.get('f')?.map((p) => p.kind)).toEqual(['step-without-connection']);
      expect(result.byObject.get('R')?.map((p) => p.kind)).toEqual(['rule-without-catch-all']);
      expect(result.byObject.has('a')).toBe(false);
    });

    it('never mutates its input', () => {
      const file = messy();
      const copy = structuredClone(file);
      checkDeck(file);
      expect(file).toEqual(copy);
    });
  });
});
