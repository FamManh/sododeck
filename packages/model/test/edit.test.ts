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
  type DeckDoc,
  type DeckEditor,
} from '../src';
import { expectValid, seqIds } from './helpers';

/** Wraps an editor so every operation is followed by a format check of the export (SC-007). */
function checked(editor: DeckEditor): DeckEditor {
  return new Proxy(editor, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const result: unknown = Reflect.apply(value, target, args);
        expectValid(target.doc);
        return result;
      };
    },
  });
}

function setup(file: SododeckFile = emptySododeckFile()): { doc: DeckDoc; editor: DeckEditor } {
  const doc = fromJSON(file);
  return { doc, editor: checked(createEditor(doc, { newId: seqIds() })) };
}

const base: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'client', title: 'Web', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'Orders' },
  ],
  groups: [{ id: 'g', title: 'Core' }],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'b', to: 'a' },
  ],
  features: [{ id: 'feat', title: 'Checkout' }],
  flows: [{ id: 'fl', title: 'Place order', steps: [{ id: 's1', edge: 'e1' }] }],
  rules: {
    'R-1': {
      title: 'Carrier',
      hitPolicy: 'first',
      inputs: [{ id: 'in1', label: 'Weight' }],
      outputs: [{ id: 'out1', label: 'Carrier' }],
      rows: [{ id: 'r1', when: ['< 5'], then: ['Post'] }],
    },
  },
};

/** Asserts that `fn` is refused with `code` and leaves the deck untouched. */
function expectRefused(doc: DeckDoc, code: DeckEditError['code'], fn: () => unknown): void {
  const before = toJSON(doc);
  let error: unknown;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(DeckEditError);
  expect((error as DeckEditError).code).toBe(code);
  expect((error as DeckEditError).issues.length).toBeGreaterThan(0);
  expect(toJSON(doc)).toEqual(before);
}

describe('collections', () => {
  it.each([
    ['nodes', { type: 'service', title: 'New' }, { title: 'Renamed' }],
    ['groups', { title: 'New' }, { title: 'Renamed' }],
    ['edges', { from: 'a', to: 'b' }, { label: 'Renamed' }],
    ['views', { type: 'system', title: 'New' }, { title: 'Renamed' }],
    ['features', { title: 'New' }, { title: 'Renamed' }],
    ['flows', { title: 'New' }, { title: 'Renamed' }],
    ['stickies', { text: 'New', position: { x: 1, y: 2 } }, { text: 'Renamed' }],
  ] as const)('adds, updates and reorders %s', (c, data, patch) => {
    const { doc, editor } = setup(base);
    const before = toJSON(doc)[c].length;
    const id = editor.add(c, data);
    expect(toJSON(doc)[c]).toHaveLength(before + 1);
    expect(getObject(doc, c, id)).toMatchObject({ id, ...data });

    editor.update(c, id, patch);
    expect(getObject(doc, c, id)).toMatchObject({ id, ...patch });

    editor.reorder(c, id, 0);
    expect(toJSON(doc)[c][0]?.id).toBe(id);
    expect(getObject(doc, c, id)).toMatchObject({ id, ...patch });
  });

  it('adds flows with an empty step list by default', () => {
    const { doc, editor } = setup(base);
    const id = editor.add('flows', { title: 'New' });
    expect(getObject(doc, 'flows', id)).toEqual({ id, title: 'New', steps: [] });
  });

  it('keeps an explicit id (paste, import)', () => {
    const { doc, editor } = setup(base);
    expect(editor.add('nodes', { id: 'pasted', type: 'queue', title: 'Q' })).toBe('pasted');
    expect(getObject(doc, 'nodes', 'pasted')).toEqual({ id: 'pasted', type: 'queue', title: 'Q' });
  });

  it('clears optional fields with null and keeps absent fields absent', () => {
    const { doc, editor } = setup(base);
    editor.update('nodes', 'a', { description: 'Hi', tags: ['x'] });
    editor.update('nodes', 'a', { description: null, owner: null });
    expect(getObject(doc, 'nodes', 'a')).toEqual({
      id: 'a',
      type: 'client',
      title: 'Web',
      tags: ['x'],
      position: { x: 0, y: 0 },
    });
  });

  it('moves a node by updating its position, and regroups it by updating its group', () => {
    const { doc, editor } = setup(base);
    editor.update('nodes', 'a', { position: { x: 10, y: -5.5 } });
    editor.update('nodes', 'b', { position: { x: 3, y: 4 }, group: 'g' });
    expect(getObject(doc, 'nodes', 'a')?.position).toEqual({ x: 10, y: -5.5 });
    expect(getObject(doc, 'nodes', 'b')).toMatchObject({ group: 'g', position: { x: 3, y: 4 } });
    editor.update('nodes', 'b', { group: null });
    expect(getObject(doc, 'nodes', 'b')?.group).toBeUndefined();
  });

  it('moves a sticky', () => {
    const { doc, editor } = setup(base);
    const id = editor.add('stickies', { text: 'Note', anchor: 'a' });
    editor.update('stickies', id, { position: { x: 5, y: 5 } });
    expect(getObject(doc, 'stickies', id)).toEqual({
      id,
      text: 'Note',
      anchor: 'a',
      position: { x: 5, y: 5 },
    });
  });

  it('clamps reorder targets to the collection bounds', () => {
    const { doc, editor } = setup(base);
    editor.reorder('nodes', 'a', 99);
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['b', 'a']);
    editor.reorder('nodes', 'a', -3);
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('deck metadata', () => {
  it('sets and clears name, description and tags', () => {
    const { doc, editor } = setup(base);
    editor.updateMeta({ name: 'Shop', description: 'All of it', tags: ['retail'] });
    expect(toJSON(doc)).toMatchObject({ name: 'Shop', description: 'All of it', tags: ['retail'] });
    editor.updateMeta({ name: null, description: null, tags: null });
    const out = toJSON(doc);
    expect(out).not.toHaveProperty('name');
    expect(out).not.toHaveProperty('description');
    expect(out).not.toHaveProperty('tags');
  });

  it('refuses an empty name', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'invalid', () => {
      editor.updateMeta({ name: '' });
    });
  });
});

describe('flow steps', () => {
  it('adds, updates and moves steps', () => {
    const { doc, editor } = setup(base);
    const s2 = editor.addStep('fl', { edge: 'e2', title: 'Reply' });
    const s0 = editor.addStep('fl', { edge: 'e1', title: 'Start' }, 0);
    expect(toJSON(doc).flows[0]?.steps.map((s) => s.id)).toEqual([s0, 's1', s2]);

    editor.updateStep('fl', 's1', {
      sla: '< 300 ms',
      rules: ['R-1'],
      ruleInputs: { 'R-1': { in1: '3' } },
    });
    expect(toJSON(doc).flows[0]?.steps[1]).toEqual({
      id: 's1',
      edge: 'e1',
      sla: '< 300 ms',
      rules: ['R-1'],
      ruleInputs: { 'R-1': { in1: '3' } },
    });

    editor.moveStep('fl', s2, 0);
    expect(toJSON(doc).flows[0]?.steps.map((s) => s.id)).toEqual([s2, s0, 's1']);
  });

  it('refuses steps on a missing edge or a missing rule, and sample inputs for unknown columns', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'missing-reference', () => editor.addStep('fl', { edge: 'nope' }));
    expectRefused(doc, 'missing-reference', () =>
      editor.addStep('fl', { edge: 'e1', rules: ['R-9'] }),
    );
    expectRefused(doc, 'missing-reference', () =>
      editor.addStep('fl', { edge: 'e1', ruleInputs: { 'R-1': { in1: '3' } } }),
    );
    expectRefused(doc, 'missing-reference', () =>
      editor.addStep('fl', { edge: 'e1', rules: ['R-1'], ruleInputs: { 'R-1': { out1: '3' } } }),
    );
    expectRefused(doc, 'not-found', () => editor.addStep('nope', { edge: 'e1' }));
    expectRefused(doc, 'not-found', () => {
      editor.updateStep('fl', 'nope', { title: 'x' });
    });
  });

  it('refuses a patch of the owned steps through update', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'invalid', () => {
      // @ts-expect-error steps are edited with the step operations
      editor.update('flows', 'fl', { steps: [] });
    });
  });
});

describe('renaming (US1 AS2)', () => {
  it('keeps the id and every reference when a node is renamed', () => {
    const { doc, editor } = setup(base);
    const before = toJSON(doc);
    editor.update('nodes', 'b', { title: 'Orders API' });
    const out = toJSON(doc);
    expect(out.nodes[1]).toEqual({ id: 'b', type: 'service', title: 'Orders API' });
    expect(out.edges).toEqual(before.edges);
    expect(out.flows).toEqual(before.flows);
  });
});

describe('refused edits (FR-007)', () => {
  it('refuses an empty title', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'invalid', () => {
      editor.update('nodes', 'a', { title: '' });
    });
    expectRefused(doc, 'invalid', () => editor.add('groups', { title: '' }));
  });

  it('refuses an unknown node type', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'invalid', () =>
      // @ts-expect-error not a node kind
      editor.add('nodes', { type: 'lambda', title: 'Fn' }),
    );
  });

  it('refuses an edge to a missing node', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'missing-reference', () => editor.add('edges', { from: 'a', to: 'zz' }));
    expectRefused(doc, 'missing-reference', () => {
      editor.update('edges', 'e1', { to: 'zz' });
    });
  });

  it('refuses other missing references', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'missing-reference', () => {
      editor.update('nodes', 'a', { group: 'zz' });
    });
    expectRefused(doc, 'missing-reference', () => {
      editor.update('nodes', 'a', { parent: 'zz' });
    });
    expectRefused(doc, 'missing-reference', () => {
      editor.update('nodes', 'a', { rules: ['zz'] });
    });
    expectRefused(doc, 'missing-reference', () => {
      editor.update('groups', 'g', { parent: 'zz' });
    });
    expectRefused(doc, 'missing-reference', () =>
      editor.add('views', { type: 'custom', title: 'V', includes: ['zz'] }),
    );
    expectRefused(doc, 'missing-reference', () =>
      editor.add('views', { type: 'custom', title: 'V', positions: { zz: { x: 0, y: 0 } } }),
    );
    expectRefused(doc, 'missing-reference', () =>
      editor.add('views', { type: 'feature', title: 'V', feature: 'zz' }),
    );
    expectRefused(doc, 'missing-reference', () =>
      editor.add('flows', { title: 'F', feature: 'zz' }),
    );
    expectRefused(doc, 'missing-reference', () =>
      editor.add('stickies', { text: 'x', anchor: 'zz' }),
    );
  });

  it('accepts a sticky anchored to any kind of object', () => {
    const { editor } = setup(base);
    for (const anchor of ['a', 'e1', 'g', 'fl', 's1', 'R-1', 'feat']) {
      expect(() => editor.add('stickies', { text: 'x', anchor })).not.toThrow();
    }
  });

  it('refuses a sticky with neither anchor nor position', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'invalid', () => editor.add('stickies', { text: 'x' }));
  });

  it('refuses an explicit id that already exists', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'duplicate-id', () =>
      editor.add('nodes', { id: 'a', type: 'client', title: 'x' }),
    );
    expectRefused(doc, 'duplicate-id', () => editor.add('groups', { id: 'e1', title: 'x' }));
    expectRefused(doc, 'duplicate-id', () => editor.addStep('fl', { id: 's1', edge: 'e1' }));
  });

  it('refuses an invalid explicit id', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'invalid', () => editor.add('groups', { id: 'has space', title: 'x' }));
  });

  it('refuses updates of unknown objects', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'not-found', () => {
      editor.update('nodes', 'zz', { title: 'x' });
    });
    expectRefused(doc, 'not-found', () => {
      editor.reorder('nodes', 'zz', 0);
    });
  });

  it('never changes an id through update', () => {
    const { doc, editor } = setup(base);
    expectRefused(doc, 'invalid', () => {
      // @ts-expect-error ids are immutable
      editor.update('nodes', 'a', { id: 'b2' });
    });
  });

  it('lets a broken object be edited', () => {
    const { doc, editor } = setup({ ...base, edges: [{ id: 'e1', from: 'a', to: 'gone' }] });
    editor.update('edges', 'e1', { label: 'still editable' });
    expect(getObject(doc, 'edges', 'e1')?.label).toBe('still editable');
  });
});

describe('batches (FR-008)', () => {
  it('moves five nodes in one change', () => {
    const file: SododeckFile = {
      ...emptySododeckFile(),
      nodes: ['1', '2', '3', '4', '5'].map((id) => ({ id, type: 'service', title: id })),
    };
    const { doc, editor } = setup(file);
    const events: DeckChange[] = [];
    observeDeck(doc, (change) => events.push(change));
    editor.batch(() => {
      for (const n of file.nodes) editor.update('nodes', n.id, { position: { x: 1, y: 1 } });
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.changes).toHaveLength(5);
  });

  it('makes no change for a no-op update', () => {
    const { doc, editor } = setup(base);
    const events: DeckChange[] = [];
    observeDeck(doc, (change) => events.push(change));
    editor.update('nodes', 'a', { title: 'Web', position: { x: 0, y: 0 } });
    expect(events).toHaveLength(0);
  });
});
