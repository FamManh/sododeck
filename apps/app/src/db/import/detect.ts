/**
 * Format and dialect detection (044 research R4): cheap, testable signals over the text, so the
 * right grammar is chosen before any parser loads. Pure.
 */
import { stripComments } from './split-sql';
import type { ImportFormat, SqlDialect } from './types';

const DBML_MARKERS = [
  /^\s*Table\s+("[^"]+"|[\w.]+)(\s+as\s+\w+)?\s*(\[[^\]]*\])?\s*\{/im,
  /^\s*Ref\s*("[^"]*"|\w+)?\s*:/im,
  /^\s*Ref\s*("[^"]*"|\w+)?\s*\{/im,
  /^\s*Enum\s+[\w."]+\s*\{/im,
  /^\s*TableGroup\s+[\w."]+/im,
  /^\s*Project\s+[\w"]*\s*\{/im,
];

/** DBML or SQL: the file extension first, else DBML block markers in the text. */
export function detectFormat(text: string, fileName?: string): ImportFormat {
  const ext = fileName?.toLowerCase().split('.').pop();
  if (ext === 'dbml') return 'dbml';
  if (ext === 'sql') return 'sql';
  return DBML_MARKERS.some((marker) => marker.test(text)) ? 'dbml' : 'sql';
}

type Signal = readonly [RegExp, SqlDialect];

const SIGNALS: readonly Signal[] = [
  [/`[^`\n]+`/, 'mysql'],
  [/\bAUTO_INCREMENT\b/i, 'mysql'],
  [/\bENGINE\s*=/i, 'mysql'],
  [/\bUNSIGNED\b/i, 'mysql'],
  [/\bENUM\s*\(/i, 'mysql'],
  [/^\s*#/m, 'mysql'],
  [/\/\*!\d+/, 'mysql'],
  [/\bLOCK TABLES\b/i, 'mysql'],
  [/::\s*[A-Za-z]/, 'postgres'],
  [/\bCREATE\s+TYPE\b[\s\S]*?\bAS\s+ENUM\b/i, 'postgres'],
  [/\b(BIG|SMALL)?SERIAL\b/i, 'postgres'],
  [/\bCOMMENT\s+ON\b/i, 'postgres'],
  [/\$\$/, 'postgres'],
  [/\bALTER\s+TABLE\s+ONLY\b/i, 'postgres'],
  [/\b(TIMESTAMPTZ|JSONB|BYTEA|UUID)\b/i, 'postgres'],
  [/\bGENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY\b/i, 'postgres'],
  [/\bpg_catalog\b/i, 'postgres'],
  [/\bAUTOINCREMENT\b/i, 'sqlite'],
  [/\bPRAGMA\b/i, 'sqlite'],
  [/\bWITHOUT\s+ROWID\b/i, 'sqlite'],
  [/\bBEGIN\s+TRANSACTION\b/i, 'sqlite'],
];

export interface DialectGuess {
  /** `null` when no dialect leads by two signals or more. */
  dialect: SqlDialect | null;
  scores: Record<SqlDialect, number>;
}

/** The dialect with the most distinct signals, when it leads the next by at least two. */
export function detectDialect(text: string): DialectGuess {
  const plain = stripComments(text);
  // `#` and `/*!` are comment-shaped, so they are looked for in the original text.
  const scores: Record<SqlDialect, number> = { postgres: 0, mysql: 0, sqlite: 0 };
  for (const [pattern, dialect] of SIGNALS) {
    const source =
      pattern.source.includes('#') || pattern.source.includes('\\/\\*!') ? text : plain;
    if (pattern.test(source)) scores[dialect]++;
  }
  const ranked = (Object.entries(scores) as [SqlDialect, number][]).sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (first === undefined || second === undefined) return { dialect: null, scores };
  return { dialect: first[1] - second[1] >= 2 ? first[0] : null, scores };
}
