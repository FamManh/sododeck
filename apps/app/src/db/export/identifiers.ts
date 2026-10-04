/**
 * Names and string literals per output (045, research R10). Pure.
 */
import { isReserved } from './reserved-words';
import type { SqlDialect } from './types';

const PLAIN_SQL = /^[a-z_][a-z0-9_]*$/;

/** Bare when plain lower case and not reserved; else quoted the dialect's way. */
export function sqlIdent(name: string, dialect: SqlDialect): string {
  if (PLAIN_SQL.test(name) && !isReserved(name)) return name;
  return dialect === 'mysql'
    ? `\`${name.replaceAll('`', '``')}\``
    : `"${name.replaceAll('"', '""')}"`;
}

/** `schema.name`, or `name` when there is no schema. */
export function qualified(schema: string | null, name: string, dialect: SqlDialect): string {
  const table = sqlIdent(name, dialect);
  return schema === null ? table : `${sqlIdent(schema, dialect)}.${table}`;
}

/** A SQL string literal: `'` doubled; MySQL also treats `\` as an escape, so it is doubled there. */
export function sqlString(text: string, dialect: SqlDialect): string {
  const escaped = dialect === 'mysql' ? text.replaceAll('\\', '\\\\') : text;
  return `'${escaped.replaceAll("'", "''")}'`;
}

const PLAIN_DBML = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function dbmlIdent(name: string): string {
  return PLAIN_DBML.test(name) ? name : `"${name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/** A DBML string: `'…'`, or `'''…'''` when it spans lines; `\` and `'` escaped. */
export function dbmlString(text: string): string {
  const escaped = text.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  return text.includes('\n') ? `'''${escaped}'''` : `'${escaped}'`;
}

export interface SafeName {
  safe: string;
  changed: boolean;
}

/**
 * A Mermaid ER entity or attribute name: letters, digits, `-` and `_`, starting with a letter.
 * Anything else becomes `_`; a name that does not start with a letter gets an `n_` prefix.
 */
export function mermaidName(name: string): SafeName {
  let safe = name.replace(/[^A-Za-z0-9_-]/g, '_');
  if (!/^[A-Za-z]/.test(safe)) safe = `n_${safe}`;
  return { safe, changed: safe !== name };
}

/**
 * A Mermaid ER attribute type: letters, digits, `-`, `_`, `(`, `)`, `[`, `]`, starting with a
 * letter. `decimal(10,2)` becomes `decimal(10-2)`, spaces become `_`.
 */
export function mermaidType(type: string): SafeName {
  let safe = type.replaceAll(',', '-').replace(/[^A-Za-z0-9_()[\]-]/g, '_');
  if (!/^[A-Za-z]/.test(safe)) safe = `t_${safe}`;
  return { safe, changed: safe !== type };
}

/** A Mermaid quoted string (labels, comments): no double quotes or line breaks inside. */
export function mermaidText(text: string): string {
  return text.replaceAll('"', "'").replace(/\s*\n\s*/g, ' ');
}
