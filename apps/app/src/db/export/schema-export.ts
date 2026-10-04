/**
 * The one entry of the schema export (045, contracts/schema-writers.md): deck + request → text,
 * notes and table count. Builds the slice once and hands it to the format's writer. Pure; never
 * throws on a schema-valid deck.
 */
import type { SododeckFile } from '@sododeck/schema';

import { slug } from '../../lib/slug';
import { writeDbml } from './dbml-writer';
import { writeDictionary } from './dictionary-writer';
import { writeMermaidEr } from './mermaid-writer';
import { mergeNotes } from './notes';
import { buildSchemaSlice, sqlDialectOf } from './schema-slice';
import { writeSql } from './sql-writer';
import type { SchemaExportRequest, SchemaExportResult, SchemaFormat, WriterOutput } from './types';

const EXTENSIONS: Record<SchemaFormat, string> = {
  sql: 'sql',
  dbml: 'dbml',
  'mermaid-er': 'mmd',
  dictionary: 'md',
};

export function schemaExport(deck: SododeckFile, request: SchemaExportRequest): SchemaExportResult {
  const slice = buildSchemaSlice(deck, request);
  const tableCount = slice.tables.length;
  if (tableCount === 0) return { text: '', notes: [], tableCount };
  let output: WriterOutput;
  switch (request.format) {
    case 'sql': {
      const dialect = sqlDialectOf(deck, request);
      // A Generic deck needs a picked dialect; the dialog asks before it calls.
      if (dialect === null) return { text: '', notes: [], tableCount };
      output = writeSql(slice, dialect, request.sql);
      break;
    }
    case 'dbml':
      output = writeDbml(slice);
      break;
    case 'mermaid-er':
      output = writeMermaidEr(slice);
      break;
    case 'dictionary':
      output = writeDictionary(slice);
      break;
  }
  const order = [...slice.tables.map((t) => t.id), ...slice.junctions.map((t) => t.id)];
  return {
    text: output.text,
    notes: mergeNotes([...slice.notes, ...output.notes], order),
    tableCount,
  };
}

/**
 * `<deck>[-<scope>][-dictionary].<sql|dbml|mmd|md>` (data-model §7): the scope slug is
 * `selection`, the database card title's slug, or nothing for the whole deck.
 */
export function schemaFileName(
  deck: Pick<SododeckFile, 'name'>,
  request: Pick<SchemaExportRequest, 'format' | 'scope'>,
  scopeTitle: string | null,
): string {
  const deckSlug = slug(deck.name) || 'untitled-deck';
  const scope =
    request.scope.kind === 'selection'
      ? 'selection'
      : request.scope.kind === 'database'
        ? slug(scopeTitle ?? '') || 'database'
        : '';
  const suffix = request.format === 'dictionary' ? '-dictionary' : '';
  return `${deckSlug}${scope === '' ? '' : `-${scope}`}${suffix}.${EXTENSIONS[request.format]}`;
}
