import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { checkIntegrity, createEditor, fromJSON, toJSON, type RemovalResult } from '../src';
import { cascadeDeck as deck } from './cascade-deck';
import { expectValid, seqIds } from './helpers';

function setup() {
  const doc = fromJSON(deck);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

/** Runs a removal, checks validity and that one undo restores the deck exactly (SC-002). */
function removeAndUndo(
  remove: (editor: ReturnType<typeof setup>['editor']) => RemovalResult,
  check: (out: SododeckFile, result: RemovalResult) => void,
): void {
  const { doc, editor } = setup();
  const before = toJSON(doc);
  const result = remove(editor);
  expectValid(doc);
  const out = toJSON(doc);
  check(out, result);
  // The reported problems are exactly what the integrity report now shows about removed objects.
  for (const problem of result.broken) expect(checkIntegrity(out)).toContainEqual(problem);

  expect(editor.undo()).toBe(true);
  expect(toJSON(doc)).toEqual(before);
  expect(editor.canUndo()).toBe(false);
}

describe('delete cascade (US3, FR-011–018)', () => {
  it('node: removes its edges, keeps steps and stickies broken, cleans views and children', () => {
    removeAndUndo(
      (editor) => editor.remove('nodes', 'n'),
      (out, result) => {
        expect(out.nodes.map((n) => n.id)).toEqual(['a', 'child']);
        expect(out.edges.map((e) => e.id)).toEqual(['e3']);
        // The step keeps all its content, pointing at the removed edge (FR-012).
        expect(out.flows[0]?.steps[0]).toEqual(deck.flows[0]?.steps[0]);
        expect(out.views[0]).toMatchObject({
          includes: ['a', 'child'],
          positions: { a: { x: 2, y: 2 } },
        });
        expect(out.nodes[1]).not.toHaveProperty('parent');
        expect(out.stickies).toEqual(deck.stickies);

        expect(result).toEqual({
          removed: [
            { scope: 'nodes', id: 'n' },
            { scope: 'edges', id: 'e1' },
            { scope: 'edges', id: 'e2' },
          ],
          updated: [
            { scope: 'nodes', id: 'child' },
            { scope: 'views', id: 'v' },
          ],
          broken: [
            {
              kind: 'missing-reference',
              object: { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } },
              field: 'edge',
              target: 'e1',
              targetType: 'edge',
            },
            {
              kind: 'missing-reference',
              object: { scope: 'stickies', id: 'st-n' },
              field: 'anchor',
              target: 'n',
              targetType: 'object',
            },
            {
              kind: 'missing-reference',
              object: { scope: 'stickies', id: 'st-e' },
              field: 'anchor',
              target: 'e1',
              targetType: 'object',
            },
          ],
        });
      },
    );
  });

  it('edge: keeps its steps and reports them', () => {
    removeAndUndo(
      (editor) => editor.remove('edges', 'e1'),
      (out, result) => {
        expect(out.edges.map((e) => e.id)).toEqual(['e2', 'e3']);
        expect(out.flows).toEqual(deck.flows);
        expect(result.removed).toEqual([{ scope: 'edges', id: 'e1' }]);
        expect(result.updated).toEqual([]);
        expect(result.broken.map((p) => [p.object.child?.id ?? p.object.id, p.field])).toEqual([
          ['s1', 'edge'],
          ['st-e', 'anchor'],
        ]);
      },
    );
  });

  it('group: moves members and child groups up to its parent, deletes nothing else', () => {
    removeAndUndo(
      (editor) => editor.remove('groups', 'inner'),
      (out, result) => {
        expect(out.groups).toEqual([
          { id: 'outer', title: 'Outer' },
          { id: 'nested', title: 'Nested', parent: 'outer' },
          { id: 'loose', title: 'Loose' },
        ]);
        expect(out.nodes.map((n) => n.group)).toEqual(['outer', 'outer', 'outer']);
        expect(out.edges).toEqual(deck.edges);
        expect(result).toEqual({
          removed: [{ scope: 'groups', id: 'inner' }],
          updated: [
            { scope: 'nodes', id: 'a' },
            { scope: 'nodes', id: 'n' },
            { scope: 'groups', id: 'nested' },
          ],
          broken: [],
        });
      },
    );
  });

  it('group without a parent: ungroups its members', () => {
    removeAndUndo(
      (editor) => editor.remove('groups', 'outer'),
      (out) => {
        expect(out.groups.find((g) => g.id === 'inner')).toEqual({ id: 'inner', title: 'Inner' });
        expect(out.nodes.find((n) => n.id === 'child')).not.toHaveProperty('group');
      },
    );
  });

  it('feature: clears the feature of flows and views', () => {
    removeAndUndo(
      (editor) => editor.remove('features', 'feat'),
      (out, result) => {
        expect(out.flows[0]).not.toHaveProperty('feature');
        expect(out.views[0]).not.toHaveProperty('feature');
        expect(result).toEqual({
          removed: [{ scope: 'features', id: 'feat' }],
          updated: [
            { scope: 'views', id: 'v' },
            { scope: 'flows', id: 'fl' },
          ],
          broken: [],
        });
      },
    );
  });

  it('flow: deletes its steps, keeps stickies anchored to it or its steps', () => {
    removeAndUndo(
      (editor) => editor.remove('flows', 'fl'),
      (out, result) => {
        expect(out.flows).toEqual([]);
        expect(out.stickies).toEqual(deck.stickies);
        expect(result.removed).toEqual([
          { scope: 'flows', id: 'fl' },
          { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } },
          { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's2' } },
        ]);
        expect(result.broken.map((p) => [p.object.id, p.target])).toEqual([
          ['st-fl', 'fl'],
          ['st-s1', 's1'],
        ]);
      },
    );
  });

  it('rule: detaches it from nodes and steps and drops its sample inputs (US3 AS2)', () => {
    removeAndUndo(
      (editor) => editor.removeRule('R'),
      (out, result) => {
        expect(out.rules).not.toHaveProperty('R');
        expect(out.nodes.map((n) => n.rules)).toEqual([undefined, undefined, ['Q']]);
        expect(out.flows[0]?.steps).toEqual([
          { id: 's1', edge: 'e1', title: 'Call', sla: '< 1 s' },
          { id: 's2', edge: 'e3', rules: ['Q'], ruleInputs: { Q: {} } },
        ]);
        expect(checkIntegrity(out)).toEqual([]);
        expect(result).toEqual({
          removed: [{ scope: 'rules', id: 'R' }],
          updated: [
            { scope: 'nodes', id: 'n' },
            { scope: 'nodes', id: 'child' },
            { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } },
            { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's2' } },
          ],
          broken: [],
        });
      },
    );
  });

  it('sticky: removes it', () => {
    removeAndUndo(
      (editor) => editor.remove('stickies', 'st-n'),
      (out, result) => {
        expect(out.stickies.map((s) => s.id)).toEqual(['st-e', 'st-fl', 'st-s1', 'st-free']);
        expect(result).toEqual({
          removed: [{ scope: 'stickies', id: 'st-n' }],
          updated: [],
          broken: [],
        });
      },
    );
  });

  it('view: removes it', () => {
    removeAndUndo(
      (editor) => editor.remove('views', 'v'),
      (out, result) => {
        expect(out.views).toEqual([]);
        expect(result.removed).toEqual([{ scope: 'views', id: 'v' }]);
      },
    );
  });

  it('step: removes one step, keeps stickies anchored to it', () => {
    removeAndUndo(
      (editor) => editor.removeStep('fl', 's1'),
      (out, result) => {
        expect(out.flows[0]?.steps.map((s) => s.id)).toEqual(['s2']);
        expect(result).toEqual({
          removed: [{ scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } }],
          updated: [],
          broken: [
            {
              kind: 'missing-reference',
              object: { scope: 'stickies', id: 'st-s1' },
              field: 'anchor',
              target: 's1',
              targetType: 'object',
            },
          ],
        });
      },
    );
  });

  it('refuses to remove something that does not exist', () => {
    const { editor } = setup();
    expect(() => editor.remove('nodes', 'zz')).toThrow(/does not exist/);
    expect(() => editor.removeRule('zz')).toThrow(/does not exist/);
    expect(() => editor.removeStep('fl', 'zz')).toThrow(/does not exist/);
    expect(editor.canUndo()).toBe(false);
  });
});
