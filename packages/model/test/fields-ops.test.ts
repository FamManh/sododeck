import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createEditor,
  DeckEditError,
  fieldsOfType,
  fromJSON,
  getObject,
  observeDeck,
  serializeDeck,
  toJSON,
  type DeckEditor,
} from '../src';
import { expectValid, seqIds } from './helpers';

const base: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 't1', type: 'task', title: 'Write spec', owner: 'Lan' },
    { id: 't2', type: 'task', title: 'Build' },
    { id: 'w1', type: 'warehouse', title: 'HCM' },
    { id: 'w2', type: 'warehouse', title: 'Hanoi' },
    { id: 's1', type: 'service', title: 'Orders', tech: 'Go' },
    { id: 'd1', type: 'database', title: 'Orders DB' },
  ],
};

function setup(file: SododeckFile = base) {
  const doc = fromJSON(file);
  const editor = createEditor(doc, { newId: seqIds() });
  return { doc, editor, deck: () => toJSON(doc) };
}

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (error) {
    return error instanceof DeckEditError ? error.code : 'other';
  }
  return null;
};

const names = (deck: SododeckFile, type: string) => fieldsOfType(deck, type).map((f) => f.name);

/** Runs `fn` and asserts it is exactly one undo step that restores the deck. */
function oneStep(editor: DeckEditor, deck: () => SododeckFile, fn: () => void): void {
  const before = serializeDeck(deck());
  fn();
  expect(serializeDeck(deck())).not.toBe(before);
  expect(editor.undo()).toBe(true);
  expect(serializeDeck(deck())).toBe(before);
  expect(editor.redo()).toBe(true);
}

describe('addField (032 US1)', () => {
  it('adds a select with options for one type, one undo step, and returns its id', () => {
    const { editor, deck } = setup();
    let id = '';
    oneStep(editor, deck, () => {
      id = editor.addField({
        name: 'Region',
        kind: 'select',
        types: ['database'],
        options: [{ label: 'North' }, { label: 'South', color: 'amber' }],
      });
    });
    expect(id).toBe('field-0');
    expect(deck().fields).toEqual([
      {
        id: 'field-0',
        name: 'Region',
        kind: 'select',
        types: ['database'],
        options: [
          { id: 'option-1', label: 'North' },
          { id: 'option-2', label: 'South', color: 'amber' },
        ],
      },
    ]);
    expect(names(deck(), 'database')).toContain('Region');
    expect(names(deck(), 'service')).not.toContain('Region');
    expect(deck().fieldDefaults).toBeUndefined();
    expectValid(editor.doc);
  });

  it('refuses an empty name or one already used in the type, ignoring case', () => {
    const { editor, deck } = setup();
    const before = serializeDeck(deck());
    expect(codeOf(() => editor.addField({ name: '  ', kind: 'text', types: ['task'] }))).toBe(
      'invalid',
    );
    expect(codeOf(() => editor.addField({ name: 'status', kind: 'text', types: ['task'] }))).toBe(
      'invalid',
    );
    expect(codeOf(() => editor.addField({ name: 'owner', kind: 'text', types: ['service'] }))).toBe(
      'invalid',
    );
    expect(serializeDeck(deck())).toBe(before);
    // The same name on another type is fine.
    expect(
      codeOf(() => editor.addField({ name: 'Status', kind: 'text', types: ['service'] })),
    ).toBe(null);
  });

  it('refuses options on a text field and a unit on a select', () => {
    const { editor } = setup();
    expect(
      codeOf(() => editor.addField({ name: 'A', kind: 'text', options: [{ label: 'x' }] })),
    ).toBe('invalid');
    expect(codeOf(() => editor.addField({ name: 'B', kind: 'select', unit: 'h' }))).toBe('invalid');
  });
});

describe('materialising a type’s defaults (032 R1)', () => {
  it('writes all of a type’s defaults and fieldDefaults on the first change, in one step', () => {
    const { editor, deck } = setup();
    oneStep(editor, deck, () => {
      editor.updateField('warehouse.sla', { name: 'SLA (h)' });
    });
    expect(deck().fieldDefaults).toEqual(['warehouse']);
    expect(deck().fields?.map((f) => [f.id, f.name])).toEqual([
      ['warehouse.capacity', 'Capacity'],
      ['warehouse.sla', 'SLA (h)'],
      ['warehouse.region', 'Region'],
    ]);
    expect(names(deck(), 'warehouse')).toEqual(['Capacity', 'SLA (h)', 'Region', 'Owner']);
    expectValid(editor.doc);
  });

  it('keeps a deleted default deleted', () => {
    const { editor, deck } = setup();
    editor.deleteField('task.due');
    expect(names(deck(), 'task')).toEqual(['Status', 'Assignee', 'Owner']);
    expect(deck().fieldDefaults).toEqual(['task']);
  });

  it('never materialises on setValues', () => {
    const { editor, deck } = setup();
    editor.setValues(['t1'], 'task.status', 'doing');
    expect(deck().fields).toBeUndefined();
    expect(deck().fieldDefaults).toBeUndefined();
    expect(getObject(editor.doc, 'nodes', 't1')?.values).toEqual({ 'task.status': 'doing' });
  });

  it('keeps a type’s order when adding a field to a type with defaults', () => {
    const { editor, deck } = setup();
    editor.addField({ name: 'Docks', kind: 'number', types: ['warehouse'] });
    editor.updateField('warehouse.capacity', { onCard: false });
    expect(names(deck(), 'warehouse')).toEqual(['Capacity', 'SLA', 'Region', 'Docks', 'Owner']);
  });
});

describe('updateField', () => {
  it('renames without touching ids or values', () => {
    const { editor, deck } = setup();
    editor.setValues(['w1'], 'warehouse.sla', 24);
    editor.updateField('warehouse.sla', { name: 'Service level' });
    expect(getObject(editor.doc, 'nodes', 'w1')?.values).toEqual({ 'warehouse.sla': 24 });
    expect(fieldsOfType(deck(), 'warehouse')[1]?.id).toBe('warehouse.sla');
  });

  it('refuses a duplicate name in the type and an empty name', () => {
    const { editor } = setup();
    expect(
      codeOf(() => {
        editor.updateField('warehouse.sla', { name: 'capacity' });
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.updateField('warehouse.sla', { name: '' });
      }),
    ).toBe('invalid');
  });

  it('extends a field to another type and back (Also use for…)', () => {
    const { editor, deck } = setup();
    const id = editor.addField({ name: 'Zone', kind: 'text', types: ['warehouse'] });
    editor.setValues(['w1'], id, 'A');
    editor.updateField(id, { types: ['warehouse', 'truck-route'] });
    expect(names(deck(), 'truck-route')).toContain('Zone');
    editor.updateField(id, { types: ['truck-route'] });
    // Removing a type keeps that type's values (reported as unused).
    expect(getObject(editor.doc, 'nodes', 'w1')?.values).toEqual({ [id]: 'A' });
    expect(
      codeOf(() => {
        editor.updateField(id, { types: [] });
      }),
    ).toBe('invalid');
  });

  it('turns a built-in on the card, storing only its entry, one step', () => {
    const { editor, deck } = setup();
    oneStep(editor, deck, () => {
      editor.updateField('owner', { onCard: true });
    });
    expect(deck().fields).toEqual([{ id: 'owner', name: 'Owner', kind: 'person', onCard: true }]);
    expect(deck().fieldDefaults).toBeUndefined();
    expect(fieldsOfType(deck(), 'service').map((f) => [f.id, f.onCard ?? false])).toEqual([
      ['tech', false],
      ['host', false],
      ['owner', true],
    ]);
    editor.updateField('owner', { onCard: false });
    expect(deck().fields).toEqual([{ id: 'owner', name: 'Owner', kind: 'person' }]);
  });

  it('refuses renaming a built-in, or a unit outside number fields', () => {
    const { editor } = setup();
    expect(
      codeOf(() => {
        editor.updateField('owner', { name: 'Team' });
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.updateField('owner', { types: ['task'] });
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.updateField('task.status', { unit: 'h' });
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.updateField('nope', { name: 'X' });
      }),
    ).toBe('not-found');
  });

  it('sets and clears a number unit', () => {
    const { editor, deck } = setup();
    editor.updateField('warehouse.sla', { unit: 'min' });
    expect(deck().fields?.[1]?.unit).toBe('min');
    editor.updateField('warehouse.sla', { unit: null });
    expect(deck().fields?.[1]?.unit).toBeUndefined();
  });
});

describe('moveField', () => {
  it('moves a field before another within the type, one undo step', () => {
    const { editor, deck } = setup();
    oneStep(editor, deck, () => {
      editor.moveField('warehouse.region', 'warehouse.capacity', 'warehouse');
    });
    expect(names(deck(), 'warehouse')).toEqual(['Region', 'Capacity', 'SLA', 'Owner']);
  });

  it('moves a built-in above defaults, and to the end', () => {
    const { editor, deck } = setup();
    editor.moveField('owner', 'task.status', 'task');
    expect(names(deck(), 'task')).toEqual(['Owner', 'Status', 'Assignee', 'Due date']);
    editor.moveField('task.status', null, 'task');
    expect(names(deck(), 'task')).toEqual(['Owner', 'Assignee', 'Due date', 'Status']);
    expectValid(editor.doc);
  });

  it('reorders built-ins of a service', () => {
    const { editor, deck } = setup();
    editor.moveField('owner', 'tech', 'service');
    expect(names(deck(), 'service')).toEqual(['Owner', 'Tech', 'Host']);
  });
});

describe('deleteField', () => {
  it('removes the definition and every value in one step; undo restores both', () => {
    const { editor, deck } = setup();
    const id = editor.addField({ name: 'Docks', kind: 'number', types: ['warehouse'] });
    editor.setValues(['w1', 'w2'], id, 4);
    oneStep(editor, deck, () => {
      editor.deleteField(id);
    });
    expect(deck().fields).toEqual([]);
    expect(getObject(editor.doc, 'nodes', 'w1')?.values).toBeUndefined();
  });

  it('refuses built-ins', () => {
    const { editor } = setup();
    expect(
      codeOf(() => {
        editor.deleteField('owner');
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.deleteField('tech');
      }),
    ).toBe('invalid');
  });
});

describe('options', () => {
  it('adds, renames, recolours, reorders and deletes options, each one step', () => {
    const { editor, deck } = setup();
    let east = '';
    oneStep(editor, deck, () => {
      east = editor.addOption('warehouse.region', { label: 'East' });
    });
    const north = editor.addOption('warehouse.region', { label: 'North', color: 'blue' });
    oneStep(editor, deck, () => {
      editor.updateOption('warehouse.region', east, { label: 'Far East', color: 'amber' });
    });
    oneStep(editor, deck, () => {
      editor.moveOption('warehouse.region', north, east);
    });
    expect(deck().fields?.find((f) => f.id === 'warehouse.region')?.options).toEqual([
      { id: north, label: 'North', color: 'blue' },
      { id: east, label: 'Far East', color: 'amber' },
    ]);
    editor.updateOption('warehouse.region', east, { color: null });
    expect(deck().fields?.find((f) => f.id === 'warehouse.region')?.options?.[1]).toEqual({
      id: east,
      label: 'Far East',
    });
  });

  it('deleting an option clears values using it in the same step', () => {
    const { editor, deck } = setup();
    const south = editor.addOption('warehouse.region', { label: 'South' });
    editor.setValues(['w1', 'w2'], 'warehouse.region', south);
    oneStep(editor, deck, () => {
      editor.deleteOption('warehouse.region', south);
    });
    expect(getObject(editor.doc, 'nodes', 'w1')?.values).toBeUndefined();
  });

  it('refuses options on non-choice fields, icons on select options and empty labels', () => {
    const { editor } = setup();
    expect(codeOf(() => editor.addOption('warehouse.sla', { label: 'x' }))).toBe('invalid');
    expect(codeOf(() => editor.addOption('warehouse.region', { label: 'x', icon: 'eye' }))).toBe(
      'invalid',
    );
    expect(codeOf(() => editor.addOption('warehouse.region', { label: ' ' }))).toBe('invalid');
    expect(codeOf(() => editor.addOption('task.status', { label: 'done' }))).toBe('invalid');
  });
});

describe('changeFieldKind (032 R6)', () => {
  it('converts what converts and clears the rest in one step', () => {
    const { editor, deck } = setup();
    const id = editor.addField({ name: 'Estimate', kind: 'text', types: ['task', 'warehouse'] });
    editor.setValues(['t1'], id, '5');
    editor.setValues(['t2'], id, '8');
    editor.setValues(['w1'], id, 'big');
    oneStep(editor, deck, () => {
      editor.changeFieldKind(id, 'number');
    });
    const values = toJSON(editor.doc).nodes.map((n) => n.values?.[id]);
    expect(values).toEqual([5, 8, undefined, undefined, undefined, undefined]);
    expect(deck().fields?.[0]?.kind).toBe('number');
    expectValid(editor.doc);
  });

  it('turns text into select options, and select into status keeping ids', () => {
    const { editor, deck } = setup();
    const id = editor.addField({ name: 'Zone', kind: 'text', types: ['warehouse'] });
    editor.setValues(['w1'], id, 'Cold');
    editor.setValues(['w2'], id, 'Dry');
    editor.changeFieldKind(id, 'select');
    const options = deck().fields?.[0]?.options ?? [];
    expect(options.map((o) => o.label)).toEqual(['Cold', 'Dry']);
    expect(getObject(editor.doc, 'nodes', 'w1')?.values?.[id]).toBe(options[0]?.id);
    editor.changeFieldKind(id, 'status');
    expect(deck().fields?.[0]?.options?.map((o) => o.id)).toEqual(options.map((o) => o.id));
    editor.changeFieldKind(id, 'number');
    expect(deck().fields?.[0]?.options).toBeUndefined();
    expectValid(editor.doc);
  });

  it('refuses built-ins and drops the unit of a number becoming text', () => {
    const { editor, deck } = setup();
    expect(
      codeOf(() => {
        editor.changeFieldKind('owner', 'text');
      }),
    ).toBe('invalid');
    editor.changeFieldKind('warehouse.sla', 'text');
    expect(deck().fields?.find((f) => f.id === 'warehouse.sla')).toEqual({
      id: 'warehouse.sla',
      name: 'SLA',
      kind: 'text',
      types: ['warehouse'],
      onCard: true,
    });
  });
});

describe('setValues (032 FR-002, FR-014b, FR-015)', () => {
  it('sets one value on several cards in one step, and null clears it', () => {
    const { editor, deck } = setup();
    oneStep(editor, deck, () => {
      editor.setValues(['w1', 'w2'], 'warehouse.capacity', 82);
    });
    expect(toJSON(editor.doc).nodes.map((n) => n.values)).toEqual([
      undefined,
      undefined,
      { 'warehouse.capacity': 82 },
      { 'warehouse.capacity': 82 },
      undefined,
      undefined,
    ]);
    editor.setValues(['w1'], 'warehouse.capacity', null);
    expect(getObject(editor.doc, 'nodes', 'w1')?.values).toBeUndefined();
  });

  it('refuses invalid values and writes nothing', () => {
    const { editor, deck } = setup();
    const before = serializeDeck(deck());
    expect(
      codeOf(() => {
        editor.setValues(['w1'], 'warehouse.capacity', 140);
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.setValues(['w1'], 'warehouse.sla', '5');
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.setValues(['t1'], 'task.status', 'nope');
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.setValues(['t1'], 'task.due', { from: '2026-10-17', to: '2026-10-06' });
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.setValues(['nope'], 'task.due', '2026-10-14');
      }),
    ).toBe('not-found');
    expect(
      codeOf(() => {
        editor.setValues(['t1'], 'nope', 'x');
      }),
    ).toBe('not-found');
    expect(serializeDeck(deck())).toBe(before);
  });

  it('writes built-ins to tech / host / owner, never to values', () => {
    const { editor } = setup();
    editor.setValues(['s1'], 'tech', 'Rust');
    editor.setValues(['t2'], 'owner', 'Minh');
    editor.setValues(['t1'], 'owner', null);
    expect(getObject(editor.doc, 'nodes', 's1')).toMatchObject({ tech: 'Rust' });
    expect(getObject(editor.doc, 'nodes', 't2')).toMatchObject({ owner: 'Minh' });
    expect(getObject(editor.doc, 'nodes', 't1')?.owner).toBeUndefined();
    expect(toJSON(editor.doc).nodes.every((n) => n.values === undefined)).toBe(true);
  });

  it('writes the deck’s existing spelling of a person', () => {
    const { editor } = setup();
    editor.setValues(['t2'], 'task.assignee', '  lan ');
    editor.setValues(['w1'], 'owner', 'LAN');
    expect(getObject(editor.doc, 'nodes', 't2')?.values).toEqual({ 'task.assignee': 'Lan' });
    expect(getObject(editor.doc, 'nodes', 'w1')?.owner).toBe('Lan');
  });

  it('reports a change of the node’s values key', () => {
    const { editor, doc } = setup();
    const keys: string[][] = [];
    const stop = observeDeck(doc, ({ changes }) => {
      for (const change of changes) keys.push(change.keys);
    });
    editor.setValues(['t1'], 'task.due', '2026-10-14');
    stop();
    expect(keys).toEqual([['values']]);
  });
});
