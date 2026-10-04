/**
 * Mermaid `erDiagram` from the schema slice (045, contracts/schema-writers.md, research R10):
 * entities with typed attributes and PK / FK / UK markers, then one line per relationship with
 * the cardinality marks. Names Mermaid cannot read are made safe and the original kept as an
 * alias or comment, with a note. Pure and deterministic.
 */
import type { Id } from '@sododeck/schema';

import { mermaidName, mermaidText, mermaidType } from './identifiers';
import { note, type ExportNote } from './notes';
import { displayName } from './schema-slice';
import type {
  SchemaSlice,
  SliceColumn,
  SliceRelationship,
  SliceTable,
  WriterOutput,
} from './types';

/** The mark for a side, as written left of `--` (`left`) or right of it (`right`). */
function mark(many: boolean, optional: boolean, side: 'left' | 'right'): string {
  if (many) return side === 'left' ? (optional ? '}o' : '}|') : optional ? 'o{' : '|{';
  return side === 'left' ? (optional ? '|o' : '||') : optional ? 'o|' : '||';
}

/** Which columns hold a foreign key in a relationship: the referencing side (research R5). */
export function foreignKeySide(rel: SliceRelationship): { table: Id; columns: readonly Id[] } {
  return rel.cardinality === '1-n'
    ? { table: rel.to, columns: rel.toColumns }
    : { table: rel.from, columns: rel.fromColumns };
}

export function writeMermaidEr(slice: SchemaSlice): WriterOutput {
  const notes: ExportNote[] = [];
  const entityName = new Map<Id, string>();
  const used = new Set<string>();
  const lines = ['erDiagram'];

  const fkColumns = new Set<Id>();
  for (const rel of slice.relationships) {
    if (rel.cardinality === 'n-n') continue;
    for (const id of foreignKeySide(rel).columns) fkColumns.add(id);
  }

  const attribute = (t: SliceTable, c: SliceColumn): string => {
    const name = mermaidName(c.name);
    const written = c.enum?.name ?? c.type.written;
    const type = mermaidType(written);
    const keys = [
      ...(c.pk ? ['PK'] : []),
      ...(fkColumns.has(c.id) ? ['FK'] : []),
      ...(c.unique ? ['UK'] : []),
    ];
    if (name.changed) {
      notes.push(
        note('name-changed', `Name \`${c.name}\` written as ${name.safe}`, {
          tableId: t.id,
          columnId: c.id,
        }),
      );
    }
    if (type.changed) {
      // Not tied to a table: one note per type, however many columns use it.
      notes.push(note('name-changed', `Type \`${written}\` written as ${type.safe}`));
    }
    const comment = [
      ...(name.changed ? [c.name] : []),
      ...(type.changed ? [written] : []),
      ...(c.note === undefined ? [] : [c.note]),
    ].join('; ');
    return `    ${type.safe} ${name.safe}${keys.length === 0 ? '' : ` ${keys.join(', ')}`}${comment === '' ? '' : ` "${mermaidText(comment)}"`}`;
  };

  for (const t of slice.tables) {
    const original = displayName(t);
    const safe = mermaidName(original);
    let name = safe.safe;
    for (let n = 2; used.has(name); n++) name = `${safe.safe}_${String(n)}`;
    used.add(name);
    entityName.set(t.id, name);
    const changed = name !== original;
    if (changed) {
      notes.push(
        note('name-changed', `Name \`${original}\` written as ${name}`, { tableId: t.id }),
      );
    }
    const head = `  ${name}${changed ? `["${mermaidText(original)}"]` : ''}`;
    if (t.columns.length === 0) lines.push(head);
    else lines.push(`${head} {`, ...t.columns.map((c) => attribute(t, c)), '  }');
  }

  const columnNames = (table: SliceTable | undefined, ids: readonly Id[]) =>
    ids.map((id) => table?.columns.find((c) => c.id === id)?.name ?? id).join(', ');
  const tableById = new Map(slice.tables.map((t) => [t.id, t]));
  for (const rel of slice.relationships) {
    const a = entityName.get(rel.from);
    const b = entityName.get(rel.to);
    if (a === undefined || b === undefined) continue;
    let marks: string;
    if (rel.cardinality === undefined) {
      marks = '}o--||';
      const from = tableById.get(rel.from);
      const to = tableById.get(rel.to);
      notes.push(
        note(
          'no-cardinality',
          `${from === undefined ? a : displayName(from)} → ${to === undefined ? b : displayName(to)} has no cardinality; drawn as many to one`,
          { tableId: rel.from },
        ),
      );
    } else {
      const [fromSide, toSide] = rel.cardinality.split('-');
      marks = `${mark(fromSide === 'n', rel.fromOptional, 'left')}--${mark(toSide === 'n', rel.toOptional, 'right')}`;
    }
    const side = foreignKeySide(rel);
    const label = rel.label ?? columnNames(tableById.get(side.table), side.columns);
    lines.push(`  ${a} ${marks} ${b} : "${mermaidText(label)}"`);
  }
  return { text: `${lines.join('\n')}\n`, notes };
}
