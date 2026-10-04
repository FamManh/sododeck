/**
 * Markdown data dictionary from the schema slice (045, research R15): one section per table
 * (note, column table, indexes, checks, references outside the export), then enums and
 * relationships. Cell text escapes `|` and turns line breaks into `<br>`; other Markdown is left
 * as typed. Pure and deterministic.
 */
import type { DbAction, Id } from '@sododeck/schema';

import { foreignKeySide } from './mermaid-writer';
import { displayName, isSqlDialect, dialectName, relationshipEndText } from './schema-slice';
import type {
  DefaultValue,
  SchemaSlice,
  SliceColumn,
  SliceRelationship,
  SliceTable,
  WriterOutput,
} from './types';

const ACTIONS: Record<DbAction, string> = {
  cascade: 'cascade',
  restrict: 'restrict',
  'set-null': 'set null',
  'set-default': 'set default',
  'no-action': 'no action',
};

function cell(text: string): string {
  return text.replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
}

function defaultText(value: DefaultValue): string {
  if (value.kind === 'expr') return `\`${value.expr}\``;
  return typeof value.value === 'string' ? `'${value.value}'` : String(value.value);
}

function side(many: boolean, optional: boolean): string {
  if (many) return optional ? 'zero or many' : 'many';
  return optional ? 'zero or one' : 'one';
}

/** "many to one" from a relationship's cardinality and optional sides; `null` without one. */
export function cardinalityText(rel: SliceRelationship): string | null {
  if (rel.cardinality === undefined) return null;
  const [from, to] = rel.cardinality.split('-');
  return `${side(from === 'n', rel.fromOptional)} to ${side(to === 'n', rel.toOptional)}`;
}

export function writeDictionary(slice: SchemaSlice): WriterOutput {
  const tableById = new Map(slice.tables.map((t) => [t.id, t]));
  const columnName = (t: SliceTable, id: Id) => t.columns.find((c) => c.id === id)?.name ?? id;

  // Column id → "customers.id" for each foreign key column, pairwise.
  const fkTargets = new Map<Id, string[]>();
  for (const rel of slice.relationships) {
    if (rel.cardinality === 'n-n' || rel.fromColumns.length !== rel.toColumns.length) continue;
    const fk = foreignKeySide(rel);
    const refTable = tableById.get(fk.table === rel.from ? rel.to : rel.from);
    const refColumns = fk.table === rel.from ? rel.toColumns : rel.fromColumns;
    if (refTable === undefined) continue;
    fk.columns.forEach((id, i) => {
      const ref = refColumns[i];
      if (ref === undefined) return;
      fkTargets.set(id, [
        ...(fkTargets.get(id) ?? []),
        `${displayName(refTable)}.${columnName(refTable, ref)}`,
      ]);
    });
  }

  const columnRow = (c: SliceColumn): string => {
    const keys = [
      ...(c.pk ? ['PK'] : []),
      ...(fkTargets.get(c.id) ?? []).map((target) => `FK → ${target}`),
      ...(c.unique ? ['UQ'] : []),
    ];
    const cells = [
      c.name,
      c.enum?.name ?? c.type.written,
      keys.join(', '),
      c.notNull || c.pk ? 'no' : 'yes',
      c.default === undefined ? '' : defaultText(c.default),
      c.note ?? '',
    ];
    return `| ${cells.map(cell).join(' | ')} |`;
  };

  const tableSection = (t: SliceTable): string[] => {
    const lines = [`## ${displayName(t)}`];
    if (t.note !== undefined) lines.push('', t.note);
    if (t.columns.length > 0) {
      lines.push(
        '',
        '| Column | Type | Key | Null | Default | Note |',
        '| --- | --- | --- | --- | --- | --- |',
        ...t.columns.map(columnRow),
      );
    }
    if (t.indexes.length > 0) {
      lines.push('', 'Indexes:', '');
      for (const index of t.indexes) {
        const parts = index.parts
          .map((p) => (p.kind === 'column' ? columnName(t, p.column) : `\`${p.expr}\``))
          .join(', ');
        const extra = [
          ...(index.unique ? ['unique'] : []),
          ...(index.method === undefined ? [] : [index.method]),
          ...(index.note === undefined ? [] : [index.note.replace(/\r?\n/g, ' ')]),
        ];
        lines.push(
          `- ${index.name ?? 'unnamed'} (${parts})${extra.map((e) => ` · ${e}`).join('')}`,
        );
      }
    }
    const checks = [
      ...t.checks.map((c) => `- ${c.name === undefined ? '' : `${c.name}: `}\`${c.expr}\``),
      ...t.columns.flatMap((c) =>
        c.check === undefined ? [] : [`- \`${c.check}\` (column ${c.name})`],
      ),
    ];
    if (checks.length > 0) lines.push('', 'Checks:', '', ...checks);
    const outside = slice.outside.filter((o) => o.tableId === t.id);
    if (outside.length > 0) {
      lines.push(
        '',
        'References outside this export:',
        '',
        ...outside.map((o) => `- ${o.reference}`),
      );
    }
    return lines;
  };

  const relationshipLine = (rel: SliceRelationship): string | null => {
    const from = tableById.get(rel.from);
    const to = tableById.get(rel.to);
    if (from === undefined || to === undefined) return null;
    const parts = [
      `${relationshipEndText(from, rel.fromColumns)} → ${relationshipEndText(to, rel.toColumns)}`,
      ...(cardinalityText(rel) === null ? [] : [cardinalityText(rel) ?? '']),
      ...(rel.onDelete === undefined ? [] : [`on delete ${ACTIONS[rel.onDelete]}`]),
      ...(rel.onUpdate === undefined ? [] : [`on update ${ACTIONS[rel.onUpdate]}`]),
      ...(rel.label === undefined ? [] : [`"${rel.label}"`]),
    ];
    return `- ${parts.join(' · ')}`;
  };

  const title = [
    slice.deckName,
    slice.scopeLabel,
    ...(isSqlDialect(slice.dialect) ? [dialectName(slice.dialect)] : []),
  ].join(' · ');
  const sections: string[][] = [[`# ${title}`], ...slice.tables.map(tableSection)];
  if (slice.enums.length > 0) {
    sections.push([
      '## Enums',
      ...slice.enums.flatMap((e) => [
        '',
        `### ${e.schema === null ? e.name : `${e.schema}.${e.name}`}`,
        ...(e.note === undefined ? [] : ['', e.note]),
        '',
        ...(e.values.length === 0
          ? ['No values.']
          : e.values.map((v) => `- \`${v.name}\`${v.note === undefined ? '' : `: ${v.note}`}`)),
      ]),
    ]);
  }
  const relationships = slice.relationships.flatMap((rel) => relationshipLine(rel) ?? []);
  if (relationships.length > 0) sections.push(['## Relationships', '', ...relationships]);
  return { text: `${sections.map((s) => s.join('\n')).join('\n\n')}\n`, notes: [] };
}
