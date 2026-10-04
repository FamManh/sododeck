/**
 * The import pipeline (044 contracts/import-pipeline.md): text + target → preview and plan.
 * split → detect → read (SQL or DBML) → `buildPlan` → suggestions. Runs in the import worker, or
 * inline where workers are missing; the parsers come from `Parsers` so tests can pass their own.
 */
import { buildPlan, type Allocator } from './build-plan';
import { detectDialect, detectFormat } from './detect';
import type { Parsers } from './load-parsers';
import { readDbml } from './read-dbml';
import { readSql } from './read-sql';
import { splitSql } from './split-sql';
import { suggestForeignKeys } from './suggest-fks';
import type {
  ImportPlan,
  ImportPreview,
  ImportSource,
  ImportTarget,
  ParseError,
  RawSchema,
  SqlDialect,
} from './types';

export interface ImportResult {
  plan: ImportPlan;
  preview: ImportPreview;
}

const isSqlDialect = (d: string): d is SqlDialect =>
  d === 'postgres' || d === 'mysql' || d === 'sqlite';

export async function runImport(
  source: ImportSource,
  target: ImportTarget,
  parsers: Parsers,
  allocate?: Allocator,
): Promise<ImportResult> {
  const format =
    source.format === 'auto' ? detectFormat(source.text, source.fileName) : source.format;
  let raw: RawSchema;
  let error: ParseError | undefined;
  let detected: SqlDialect | null = null;
  let importDialect: SqlDialect | null;
  let grammar: SqlDialect | null = null;
  if (format === 'dbml') {
    const read = readDbml(source.text, await parsers.dbml());
    raw = read.raw;
    error = read.error;
    importDialect = raw.dialect ?? null;
  } else {
    const statements = splitSql(source.text);
    detected = detectDialect(source.text).dialect;
    const picked = source.dialect === 'auto' ? null : source.dialect;
    importDialect = picked ?? detected;
    // Nothing detected: read with the deck's grammar (Postgres for a Generic deck), claim nothing.
    grammar = importDialect ?? (isSqlDialect(target.deckDialect) ? target.deckDialect : 'postgres');
    const read = readSql(statements, grammar, await parsers.sql(grammar));
    raw = read.raw;
    error = read.error;
  }
  const plan = buildPlan(raw, source, target, {
    importDialect,
    ...(allocate === undefined ? {} : { allocate }),
  });
  if (source.detectFk) plan.suggestions = suggestForeignKeys(plan);
  const preview: ImportPreview = {
    format,
    detectedDialect: detected,
    dialect: format === 'dbml' ? importDialect : grammar,
    counts: {
      tables: plan.report.mapped.tables,
      relationships: plan.report.mapped.relationships,
      enums: plan.report.mapped.enums,
    },
    skippedCount: plan.report.skipped.length,
    conversions: plan.conversions,
    dialectOutcome: plan.dialectOutcome,
    ...(error === undefined ? {} : { error }),
  };
  return { plan, preview };
}
