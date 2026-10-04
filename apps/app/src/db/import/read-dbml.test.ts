import { describe, expect, it } from 'vitest';

import { DBML_CORPUS } from '../fixtures/import/corpus';
import { createParsers } from './load-parsers';
import { readDbml } from './read-dbml';

const parsers = createParsers();
const read = async (text: string) => readDbml(text, await parsers.dbml());

describe('readDbml', () => {
  it('reads tables, settings, indexes, checks, notes and header colours', async () => {
    const { raw, error } = await read(DBML_CORPUS['extras.dbml']);
    expect(error).toBeUndefined();
    expect(raw.dialect).toBe('postgres');
    expect(raw.projectNote).toBe('Customer relationship schema');
    const companies = raw.tables.find((t) => t.name === 'companies');
    expect(companies).toMatchObject({
      schema: 'crm',
      headerColor: '#3498DB',
      note: 'A company we sell to',
    });
    expect(companies?.columns[0]).toMatchObject({
      name: 'id',
      type: 'int',
      pk: true,
      increment: true,
    });
    expect(companies?.columns[1]).toMatchObject({
      type: 'varchar(120)',
      notNull: true,
      unique: true,
    });
    const deals = raw.tables.find((t) => t.name === 'deals');
    expect(deals?.columns.find((c) => c.name === 'stage')).toMatchObject({
      type: 'deal_stage',
      typeSchema: 'crm',
      default: { kind: 'value', value: 'lead' },
    });
    expect(deals?.columns.find((c) => c.name === 'closed_at')?.default).toEqual({
      kind: 'expr',
      expr: 'now()',
    });
    expect(deals?.indexes.map((i) => ({ ...i, line: undefined }))).toEqual([
      {
        name: 'deals_company_stage_idx',
        parts: [{ column: 'company_id' }, { column: 'stage' }],
        line: undefined,
      },
      { parts: [{ expr: 'lower(stage::text)' }], method: 'hash', line: undefined },
    ]);
    expect(deals?.checks).toEqual([
      expect.objectContaining({ name: 'deals_amount_check', expr: 'amount >= 0' }),
    ]);
    expect(raw.tables.find((t) => t.name === 'deal_contacts')?.indexes[0]).toMatchObject({
      pk: true,
    });
  });

  it('reads refs in every form with cardinality, optional ends, actions and names', async () => {
    const { raw } = await read(DBML_CORPUS['extras.dbml']);
    const summary = raw.refs.map((r) => [
      `${r.from.name}.${r.from.columns.join(',')}`,
      `${r.to.name}.${r.to.columns.join(',')}`,
      r.cardinality,
      r.fromOptional ?? false,
      r.toOptional ?? false,
      r.name ?? null,
    ]);
    expect(summary).toEqual([
      ['contacts.company_id', 'companies.id', 'n-1', false, false, null],
      ['deals.company_id', 'companies.id', 'n-1', false, false, null],
      ['deal_contacts.deal_id', 'deals.id', 'n-1', false, false, 'deal_link'],
      ['deal_contacts.contact_id', 'contacts.id', 'n-1', true, false, null],
      ['contacts.manager_id', 'contacts.id', 'n-1', true, true, null],
      ['contacts.id', 'companies.id', '1-1', false, false, null],
      ['tags.id', 'deals.id', 'n-n', false, false, null],
    ]);
    expect(raw.refs[1]).toMatchObject({ onDelete: 'cascade', onUpdate: 'no-action' });
  });

  it('reads enums with value notes, table groups and sticky notes', async () => {
    const { raw } = await read(DBML_CORPUS['extras.dbml']);
    expect(raw.enums[0]).toMatchObject({
      name: 'deal_stage',
      schema: 'crm',
      values: [{ name: 'lead', note: 'Not qualified yet' }, { name: 'won' }, { name: 'lost' }],
    });
    expect(raw.groups).toEqual([
      expect.objectContaining({
        name: 'sales',
        color: '#E67E22',
        note: 'Pipeline tables',
        tables: [
          { schema: 'crm', name: 'deals' },
          { schema: 'crm', name: 'deal_contacts' },
        ],
      }),
    ]);
    expect(raw.notes).toEqual([
      expect.objectContaining({ text: 'Imported from the CRM repository' }),
    ]);
  });

  it('reads the comment written above an enum as its note (045 writes enum notes that way)', async () => {
    const { raw } = await read(DBML_CORPUS['shop.dbml']);
    expect(raw.enums[0]?.note).toBe('Where an order is in its life');
  });

  it('reports the first compile error with its 1-based line', async () => {
    const { error, raw } = await read(
      'Table a {\n  id int [pk]\n}\n\nTable b {\n  id int [pk, wat]\n}',
    );
    expect(error?.line).toBe(6);
    expect(error?.message.length).toBeGreaterThan(0);
    expect(raw.tables).toEqual([]);
  });
});
