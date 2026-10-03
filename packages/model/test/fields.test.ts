import { emptySododeckFile, type FieldDef, type Node, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_FIELDS,
  canonicalPerson,
  CARD_TYPES,
  cardType,
  fieldsOfNode,
  fieldsOfType,
  fieldUsage,
  findField,
  personSuggestions,
  STATUS_OPTIONS,
} from '../src';

const ARCHITECTURE = ['service', 'database', 'gateway', 'client', 'queue', 'external', 'component'];

function deck(patch: Partial<SododeckFile> = {}): SododeckFile {
  return { ...emptySododeckFile(), ...patch };
}

const ids = (fields: readonly { id: string }[]) => fields.map((field) => field.id);

describe('built-in fields (032)', () => {
  it('are Tech and Host for Architecture types and Owner for every type, all off the card', () => {
    expect(BUILT_IN_FIELDS).toEqual([
      { id: 'tech', name: 'Tech', kind: 'text', types: ARCHITECTURE },
      { id: 'host', name: 'Host', kind: 'text', types: ARCHITECTURE },
      { id: 'owner', name: 'Owner', kind: 'person' },
    ]);
  });
});

describe('default fields per type (032 founder table)', () => {
  const table = Object.fromEntries(
    CARD_TYPES.map((type) => [
      type.id,
      type.defaultFields.map((f) => [f.id, f.name, f.kind, f.unit ?? null]),
    ]),
  );

  it('match the founder table exactly', () => {
    expect(table).toEqual({
      service: [],
      database: [],
      gateway: [],
      client: [],
      queue: [],
      external: [],
      component: [],
      task: [
        ['task.status', 'Status', 'status', null],
        ['task.assignee', 'Assignee', 'person', null],
        ['task.due', 'Due date', 'date', null],
      ],
      decision: [],
      document: [['document.link', 'Link', 'link', null]],
      warehouse: [
        ['warehouse.capacity', 'Capacity', 'progress', null],
        ['warehouse.sla', 'SLA', 'number', 'h'],
        ['warehouse.region', 'Region', 'select', null],
      ],
      'truck-route': [['truck-route.departure', 'Departure', 'date', null]],
      issue: [
        ['issue.status', 'Status', 'status', null],
        ['issue.assignee', 'Assignee', 'person', null],
        ['issue.dates', 'Dates', 'dateRange', null],
        ['issue.estimate', 'Estimate', 'number', 'pts'],
      ],
    });
  });

  it('are on the card, apply to their own type only, and Region starts with no options', () => {
    for (const type of CARD_TYPES) {
      for (const field of type.defaultFields) {
        expect(field.onCard).toBe(true);
        expect(field.types).toEqual([type.id]);
      }
    }
    expect(findField(deck(), 'warehouse.region')?.options).toBeUndefined();
  });

  it('give Status To do (slate, circle), In progress (blue, circle-dot), Done (green, check)', () => {
    expect(STATUS_OPTIONS).toEqual([
      { id: 'todo', label: 'To do', color: 'slate', icon: 'circle' },
      { id: 'doing', label: 'In progress', color: 'blue', icon: 'circle-dot' },
      { id: 'done', label: 'Done', color: 'green', icon: 'circle-check' },
    ]);
    expect(cardType('issue')?.defaultFields[0]?.options).toEqual(STATUS_OPTIONS);
  });
});

describe('fieldsOfType (032 R1)', () => {
  it('lists a Task: Status, Assignee, Due date, then Owner', () => {
    const fields = fieldsOfType(deck(), 'task');
    expect(fields.map((f) => [f.name, f.source])).toEqual([
      ['Status', 'default'],
      ['Assignee', 'default'],
      ['Due date', 'default'],
      ['Owner', 'built-in'],
    ]);
  });

  it('lists a Service: Tech, Host, Owner; an unknown type: Owner only', () => {
    expect(ids(fieldsOfType(deck(), 'service'))).toEqual(['tech', 'host', 'owner']);
    expect(ids(fieldsOfType(deck(), 'robot'))).toEqual(['owner']);
  });

  it('adds deck fields for the type in deck order, before the built-ins', () => {
    const fields: FieldDef[] = [
      { id: 'f_b', name: 'B', kind: 'text', types: ['warehouse'] },
      { id: 'f_svc', name: 'Svc', kind: 'text', types: ['service'] },
      { id: 'f_all', name: 'All', kind: 'number' },
    ];
    expect(ids(fieldsOfType(deck({ fields }), 'warehouse'))).toEqual([
      'warehouse.capacity',
      'warehouse.sla',
      'warehouse.region',
      'f_b',
      'f_all',
      'owner',
    ]);
    expect(ids(fieldsOfType(deck({ fields }), 'service'))).toEqual([
      'f_svc',
      'f_all',
      'tech',
      'host',
      'owner',
    ]);
  });

  it('uses only deck entries for a materialised type, so a deleted default stays deleted', () => {
    const fields: FieldDef[] = [
      { id: 'task.due', name: 'Deadline', kind: 'date', types: ['task'], onCard: true },
      { id: 'task.status', name: 'Status', kind: 'status', types: ['task'] },
    ];
    const resolved = fieldsOfType(deck({ fields, fieldDefaults: ['task'] }), 'task');
    expect(resolved.map((f) => [f.id, f.name, f.onCard ?? false, f.source])).toEqual([
      ['task.due', 'Deadline', true, 'deck'],
      ['task.status', 'Status', false, 'deck'],
      ['owner', 'Owner', false, 'built-in'],
    ]);
  });

  it('lets a deck entry with a built-in id set order and on-card, never name or kind', () => {
    const fields: FieldDef[] = [
      { id: 'f_a', name: 'A', kind: 'text' },
      { id: 'owner', name: 'Whoever', kind: 'person', onCard: true },
    ];
    const resolved = fieldsOfType(deck({ fields }), 'service');
    expect(resolved.map((f) => [f.id, f.name, f.onCard ?? false])).toEqual([
      ['f_a', 'A', false],
      ['tech', 'Tech', false],
      ['host', 'Host', false],
      ['owner', 'Owner', true],
    ]);
  });

  it('keeps built-ins in code order around a stored one', () => {
    const fields: FieldDef[] = [{ id: 'host', name: 'Host', kind: 'text', onCard: true }];
    expect(ids(fieldsOfType(deck({ fields }), 'service'))).toEqual(['tech', 'host', 'owner']);
  });

  it('is memoised per field list and type', () => {
    const d = deck({ fields: [{ id: 'f', name: 'F', kind: 'text' }] });
    expect(fieldsOfType(d, 'task')).toBe(fieldsOfType({ ...d }, 'task'));
    expect(fieldsOfType(d, 'task')).not.toBe(fieldsOfType(d, 'issue'));
  });
});

describe('fieldsOfNode', () => {
  it('adds Tech / Host to a card of another type that already holds a value', () => {
    const node: Node = { id: 'n', type: 'task', title: 'T', host: 'EKS' };
    expect(ids(fieldsOfNode(deck(), node))).toEqual([
      'task.status',
      'task.assignee',
      'task.due',
      'host',
      'owner',
    ]);
  });
});

describe('fieldUsage', () => {
  const d = deck({
    nodes: [
      { id: 'a', type: 'task', title: 'A', owner: 'Lan', values: { 'task.status': 'done' } },
      { id: 'b', type: 'task', title: 'B', values: { 'task.status': 'todo' } },
      { id: 'c', type: 'task', title: 'C' },
    ],
  });
  it('counts cards holding a value, or a given option', () => {
    expect(fieldUsage(d, 'task.status')).toBe(2);
    expect(fieldUsage(d, 'task.status', 'done')).toBe(1);
    expect(fieldUsage(d, 'owner')).toBe(1);
    expect(fieldUsage(d, 'task.due')).toBe(0);
  });
});

describe('person suggestions (032 R7)', () => {
  const d = deck({
    fields: [{ id: 'f_mgr', name: 'Manager', kind: 'person' }],
    nodes: [
      { id: 'a', type: 'task', title: 'A', owner: 'Lan', values: { 'task.assignee': 'Minh Tran' } },
      { id: 'b', type: 'task', title: 'B', owner: 'lan', values: { f_mgr: 'Bao' } },
      { id: 'c', type: 'task', title: 'C', values: { 'task.status': 'Not a person' } },
    ],
  });

  it('lists owners and person values once ignoring case, first spelling, sorted', () => {
    expect(personSuggestions(d)).toEqual(['Bao', 'Lan', 'Minh Tran']);
  });

  it('writes the existing spelling for a name equal ignoring case and spacing', () => {
    expect(canonicalPerson(d, 'lan')).toBe('Lan');
    expect(canonicalPerson(d, '  minh   TRAN ')).toBe('Minh Tran');
    expect(canonicalPerson(d, ' New Person ')).toBe('New Person');
  });
});
