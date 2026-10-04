/**
 * SQL statement splitter (044 research R2). One pass over the text that knows quotes (`'…'` with
 * `''` and backslash escapes, `"…"`, `` `…` ``), `$tag$…$tag$` bodies, comments (`--`, `#`,
 * `/* *\/`), MySQL `DELIMITER` and `COPY … FROM stdin` data blocks ending at `\.`, so each
 * statement keeps its own 1-based line and one failing statement never fails the import. Pure.
 */
import type { Statement, StatementKind } from './types';

const isIdentChar = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9_$]/.test(ch);
const DOLLAR_TAG = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/;

/** The text with comments replaced by spaces (strings kept), for keyword classification. */
export function stripComments(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i] ?? '';
    const next = text[i + 1];
    if (ch === '-' && next === '-') {
      while (i < text.length && text[i] !== '\n') i++;
      out += ' ';
    } else if (ch === '#') {
      while (i < text.length && text[i] !== '\n') i++;
      out += ' ';
    } else if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      out += ' ';
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const end = skipQuoted(text, i);
      out += text.slice(i, end);
      i = end;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** Index just after the quoted run starting at `start` (`''` / `""` doubling, `\` escapes in `'`). */
function skipQuoted(text: string, start: number): number {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (quote === "'" && ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) {
      if (text[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return text.length;
}

const words = (head: string) => head.toUpperCase().replace(/\s+/g, ' ').trim();

const CREATE_PREFIX = String.raw`^CREATE (OR REPLACE )?(((ALGORITHM|DEFINER|SQL SECURITY) ?= ?\S+|TEMP|TEMPORARY|UNLOGGED|GLOBAL|LOCAL|MATERIALIZED|RECURSIVE|CONSTRAINT|AGGREGATE) )*`;

const createOf = (kind: string) => new RegExp(`${CREATE_PREFIX}${kind}\\b`);

const RULES: readonly [RegExp, StatementKind][] = [
  [
    /^CREATE (OR REPLACE )?((TEMP|TEMPORARY|UNLOGGED|GLOBAL|LOCAL) )*TABLE\b.*\bPARTITION OF\b/,
    'partition',
  ],
  [/^CREATE (OR REPLACE )?((TEMP|TEMPORARY|UNLOGGED|GLOBAL|LOCAL) )*TABLE\b/, 'create-table'],
  [/^CREATE TYPE\b/, 'create-type'],
  [/^CREATE (UNIQUE )?(FULLTEXT |SPATIAL )?INDEX\b/, 'create-index'],
  [createOf('VIEW'), 'view'],
  [createOf('(FUNCTION|AGGREGATE|OPERATOR|CAST)'), 'function'],
  [createOf('PROCEDURE'), 'procedure'],
  [createOf('(TRIGGER|EVENT|RULE)'), 'trigger'],
  [/^(CREATE|ALTER) SEQUENCE\b/, 'sequence'],
  [/^SELECT (PG_CATALOG\.)?SETVAL\b/, 'sequence'],
  [/^SELECT (PG_CATALOG\.)?SET_CONFIG\b/, 'session'],
  [/^(CREATE|ALTER|DROP) EXTENSION\b/, 'extension'],
  [/^COMMENT ON EXTENSION\b/, 'extension'],
  [/^CREATE SCHEMA\b/, 'schema'],
  [/^COMMENT ON SCHEMA\b/, 'schema'],
  [/^COMMENT ON (FUNCTION|PROCEDURE|AGGREGATE)\b/, 'function'],
  [/^COMMENT ON (TABLE|COLUMN)\b/, 'comment-on'],
  [/^(CREATE|ALTER) POLICY\b/, 'policy'],
  [/^ALTER TABLE\b.*\b(ENABLE|DISABLE|FORCE|NO FORCE) ROW LEVEL SECURITY\b/, 'policy'],
  [/^ALTER TABLE\b.*\bOWNER TO\b/, 'grant'],
  [/^ALTER TABLE\b.*\bATTACH PARTITION\b/, 'partition'],
  [/^ALTER TABLE\b/, 'alter-table'],
  [/^ALTER \w+( \w+)?\b.*\bOWNER TO\b/, 'grant'],
  [/^(GRANT|REVOKE)\b/, 'grant'],
  [/^ALTER DEFAULT PRIVILEGES\b/, 'grant'],
  [/^CREATE (ROLE|USER)\b/, 'grant'],
  [/^(INSERT|COPY|REPLACE|UPDATE|DELETE|MERGE)\b/, 'data'],
  [
    /^(SET|RESET|PRAGMA|BEGIN|START TRANSACTION|COMMIT|ROLLBACK|END|USE|LOCK|UNLOCK|DELIMITER|ANALYZE|VACUUM)\b/,
    'session',
  ],
  [/^\\/, 'session'],
  [/^(DROP|TRUNCATE|RENAME)\b/, 'drop'],
];

/** The kind of a statement from its first keywords (comments ignored). */
export function classify(text: string): StatementKind {
  const head = words(stripComments(text).slice(0, 400));
  for (const [pattern, kind] of RULES) if (pattern.test(head)) return kind;
  return 'other';
}

interface Cursor {
  i: number;
  line: number;
}

/**
 * Splits `text` into statements. Every character outside comments and blank space belongs to
 * exactly one statement; a statement's text runs from its first token to just before its
 * delimiter. MySQL `DELIMITER x` lines and psql meta-commands (`\connect`) are statements of
 * their own (kind `session`).
 */
export function splitSql(text: string): Statement[] {
  const statements: Statement[] = [];
  let delimiter = ';';
  const cur: Cursor = { i: 0, line: 1 };
  const n = text.length;

  const advance = (to: number) => {
    for (let k = cur.i; k < to && k < n; k++) if (text[k] === '\n') cur.line++;
    cur.i = Math.min(to, n);
  };

  const push = (start: number, startLine: number, end: number) => {
    const body = text.slice(start, end).trimEnd();
    if (body === '') return;
    const endLine = startLine + (body.match(/\n/g)?.length ?? 0);
    statements.push({ text: body, line: startLine, endLine, kind: classify(body) });
  };

  while (cur.i < n) {
    // Skip blank space and comments between statements.
    const ch = text[cur.i] ?? '';
    const next = text[cur.i + 1];
    if (/\s/.test(ch)) {
      advance(cur.i + 1);
      continue;
    }
    if ((ch === '-' && next === '-') || ch === '#') {
      const end = text.indexOf('\n', cur.i);
      advance(end === -1 ? n : end);
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', cur.i + 2);
      advance(end === -1 ? n : end + 2);
      continue;
    }

    const start = cur.i;
    const startLine = cur.line;
    const lineEnd = text.indexOf('\n', start);
    const firstLine = text.slice(start, lineEnd === -1 ? n : lineEnd);

    // Client directives end at the end of their line.
    const delim = /^DELIMITER\s+(\S+)/i.exec(firstLine);
    if (delim !== null || ch === '\\') {
      if (delim?.[1] !== undefined) delimiter = delim[1];
      advance(lineEnd === -1 ? n : lineEnd);
      push(start, startLine, cur.i);
      continue;
    }

    // Scan to the delimiter, skipping quoted runs, dollar bodies and comments.
    let end = -1;
    while (cur.i < n) {
      const c = text[cur.i] ?? '';
      const d = text[cur.i + 1];
      if (c === "'" || c === '"' || c === '`') {
        advance(skipQuoted(text, cur.i));
        continue;
      }
      if (c === '$' && !isIdentChar(text[cur.i - 1])) {
        const tag = DOLLAR_TAG.exec(text.slice(cur.i, cur.i + 66));
        if (tag !== null) {
          const close = text.indexOf(tag[0], cur.i + tag[0].length);
          advance(close === -1 ? n : close + tag[0].length);
          continue;
        }
      }
      if ((c === '-' && d === '-') || c === '#') {
        const eol = text.indexOf('\n', cur.i);
        advance(eol === -1 ? n : eol);
        continue;
      }
      if (c === '/' && d === '*') {
        const close = text.indexOf('*/', cur.i + 2);
        advance(close === -1 ? n : close + 2);
        continue;
      }
      if (text.startsWith(delimiter, cur.i)) {
        end = cur.i;
        break;
      }
      advance(cur.i + 1);
    }
    if (end === -1) {
      push(start, startLine, n);
      break;
    }
    const body = text.slice(start, end);
    advance(end + delimiter.length);
    // `COPY … FROM stdin;` is followed by data lines up to a line holding `\.`.
    if (/^COPY\b[\s\S]*\bFROM\s+STDIN\b/i.test(body)) {
      const close = /^\\\.[ \t]*$/m.exec(text.slice(cur.i));
      const stop = close === null ? n : cur.i + close.index + close[0].length;
      advance(stop);
      push(start, startLine, stop);
      continue;
    }
    push(start, startLine, end);
  }
  return statements;
}
