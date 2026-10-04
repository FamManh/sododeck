/**
 * Pre-pass for parser gaps (044 research R3). Column types are read here from the source text and
 * replaced by `text` before parsing, so the parser never fails on a user type (`order_status`),
 * an unusual spelling (`timestamp(3) with time zone`) or a dialect type it lacks; the original
 * type is restored when mapping. `GENERATED ALWAYS AS IDENTITY` becomes `BY DEFAULT` (both mean
 * auto-increment), generated expressions are removed and reported, and `::type` casts are
 * stripped (the parser rejects casts to user types; the literal or expression stays). Pure.
 */

/** What a column definition looked like before the rewrite, in definition order. */
export interface ColumnSource {
  name: string;
  /** Lower case, spaces collapsed, size kept (`varchar(255)`); `''` when untyped. */
  type: string;
  /** 1-based line of the column definition. */
  line: number;
  /** Options removed before parsing ("generated expression"). */
  dropped: string[];
}

export interface PreparedStatement {
  text: string;
  columns: ColumnSource[];
}

/** Keywords that end a column's type. */
const TYPE_STOP = new Set([
  'CONSTRAINT',
  'NOT',
  'NULL',
  'DEFAULT',
  'PRIMARY',
  'UNIQUE',
  'CHECK',
  'REFERENCES',
  'COLLATE',
  'GENERATED',
  'AUTO_INCREMENT',
  'AUTOINCREMENT',
  'COMMENT',
  'ON',
  'AS',
  'IDENTITY',
  'KEY',
  'CHARSET',
  'VISIBLE',
  'INVISIBLE',
  'STORAGE',
  'COLUMN_FORMAT',
  'SRID',
]);

const CONSTRAINT_START =
  /^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE\b|CHECK\b|FOREIGN\s+KEY|FULLTEXT\b|SPATIAL\b|EXCLUDE\b|LIKE\b|PERIOD\b|((UNIQUE\s+)?(KEY|INDEX))\s*(\S+\s*)?\()/i;

interface Part {
  start: number;
  end: number;
}

/** Index after the quoted run at `i` (same rules as the splitter). */
function skipQuoted(text: string, i: number): number {
  const quote = text[i];
  let k = i + 1;
  while (k < text.length) {
    const ch = text[k];
    if (quote === "'" && ch === '\\') {
      k += 2;
      continue;
    }
    if (ch === quote) {
      if (text[k + 1] === quote) {
        k += 2;
        continue;
      }
      return k + 1;
    }
    k++;
  }
  return text.length;
}

/** Index of the `)` closing the `(` at `open`, or -1. */
function closeParen(text: string, open: number): number {
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    const ch = text[k];
    if (ch === "'" || ch === '"' || ch === '`') {
      k = skipQuoted(text, k) - 1;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

/** Top-level comma-separated parts of `text` between `from` and `to`. */
function splitTopLevel(text: string, from: number, to: number): Part[] {
  const parts: Part[] = [];
  let depth = 0;
  let start = from;
  for (let k = from; k < to; k++) {
    const ch = text[k];
    if (ch === "'" || ch === '"' || ch === '`') {
      k = skipQuoted(text, k) - 1;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push({ start, end: k });
      start = k + 1;
    }
  }
  parts.push({ start, end: to });
  return parts;
}

interface Token {
  text: string;
  start: number;
  end: number;
}

/** The next token at or after `i`: a quoted name, a word, a `(…)` group, or one character. */
function nextToken(text: string, i: number, end: number): Token | null {
  let k = i;
  while (k < end && /\s/.test(text[k] ?? '')) k++;
  if (k >= end) return null;
  const ch = text[k] ?? '';
  if (ch === '"' || ch === '`' || ch === '[') {
    const close = ch === '[' ? text.indexOf(']', k) + 1 : skipQuoted(text, k);
    const stop = close <= 0 ? end : Math.min(close, end);
    return { text: text.slice(k, stop), start: k, end: stop };
  }
  if (ch === '(') {
    const close = closeParen(text, k);
    const stop = close === -1 ? end : close + 1;
    return { text: text.slice(k, stop), start: k, end: stop };
  }
  if (/[A-Za-z0-9_$]/.test(ch)) {
    let e = k;
    while (e < end && /[A-Za-z0-9_$]/.test(text[e] ?? '')) e++;
    return { text: text.slice(k, e), start: k, end: e };
  }
  return { text: ch, start: k, end: k + 1 };
}

const unquote = (name: string) =>
  /^["`[]/.test(name) ? name.slice(1, -1).replace(/""/g, '"').replace(/``/g, '`') : name;

const lineAt = (text: string, offset: number, base: number) =>
  base + (text.slice(0, offset).match(/\n/g)?.length ?? 0);

interface Edit {
  start: number;
  end: number;
  replacement: string;
}

/**
 * The type span and the rewrites of one column definition starting at `start`. Returns null when
 * the definition has no name.
 */
function columnEdits(
  text: string,
  start: number,
  end: number,
  baseLine: number,
  quote: string,
): { column: ColumnSource; edits: Edit[] } | null {
  const nameToken = nextToken(text, start, end);
  if (nameToken === null) return null;
  const edits: Edit[] = [];
  // A bare name is quoted, so a column named like a keyword (`at`, `key`) still parses.
  if (/^[A-Za-z_][A-Za-z0-9_$]*$/.test(nameToken.text)) {
    edits.push({
      start: nameToken.start,
      end: nameToken.end,
      replacement: `${quote}${nameToken.text}${quote}`,
    });
  }
  const dropped: string[] = [];
  let typeStart = -1;
  let typeEnd = -1;
  let k = nameToken.end;
  for (;;) {
    const token = nextToken(text, k, end);
    if (token === null) break;
    const upper = token.text.toUpperCase();
    const isWord = /^[A-Za-z_]/.test(token.text);
    if (isWord && TYPE_STOP.has(upper)) break;
    // `CHARACTER SET` ends the type; `character varying` does not.
    if (upper === 'CHARACTER') {
      const after = nextToken(text, token.end, end);
      if (after?.text.toUpperCase() === 'SET') break;
    }
    if (typeStart === -1) typeStart = token.start;
    typeEnd = token.end;
    k = token.end;
  }
  const type =
    typeStart === -1
      ? ''
      : text.slice(typeStart, typeEnd).replace(/\s+/g, ' ').trim().toLowerCase();
  if (typeStart !== -1) edits.push({ start: typeStart, end: typeEnd, replacement: 'text' });

  const rest = text.slice(typeEnd === -1 ? nameToken.end : typeEnd, end);
  const restStart = typeEnd === -1 ? nameToken.end : typeEnd;
  // GENERATED ALWAYS AS IDENTITY [(options)] → BY DEFAULT (both are auto-increment).
  const identity = /\bGENERATED\s+ALWAYS\s+AS\s+IDENTITY(\s*\([^()]*\))?/i.exec(rest);
  if (identity !== null) {
    edits.push({
      start: restStart + identity.index,
      end: restStart + identity.index + identity[0].length,
      replacement: 'GENERATED BY DEFAULT AS IDENTITY',
    });
  }
  // [GENERATED ALWAYS] AS (expr) [STORED | VIRTUAL] → removed and reported.
  const generated = /(\bGENERATED\s+ALWAYS\s+)?\bAS\s*\(/i.exec(rest);
  if (generated !== null && !/IDENTITY/i.test(rest.slice(generated.index, generated.index + 40))) {
    const open = restStart + generated.index + generated[0].length - 1;
    const close = closeParen(text, open);
    if (close !== -1) {
      const tail = /^\s*(STORED|VIRTUAL|PERSISTENT)\b/i.exec(text.slice(close + 1, end));
      edits.push({
        start: restStart + generated.index,
        end: close + 1 + (tail?.[0].length ?? 0),
        replacement: '',
      });
      dropped.push('generated expression');
    }
  }
  return {
    column: {
      name: unquote(nameToken.text),
      type,
      line: lineAt(text, nameToken.start, baseLine),
      dropped,
    },
    edits,
  };
}

const CAST =
  /^::\s*("[^"]+"|[A-Za-z_][\w$]*)(\s*\.\s*("[^"]+"|[A-Za-z_][\w$]*))?(\s+(varying|precision|with\s+time\s+zone|without\s+time\s+zone))*(\s*\(\s*\d+(\s*,\s*\d+)?\s*\))?(\s*\[\s*\])*/i;

/** `text` without `::type` casts outside quotes. */
export function stripCasts(text: string): string {
  let out = '';
  let k = 0;
  while (k < text.length) {
    const ch = text[k] ?? '';
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = skipQuoted(text, k);
      out += text.slice(k, end);
      k = end;
      continue;
    }
    if (ch === ':' && text[k + 1] === ':') {
      const cast = CAST.exec(text.slice(k));
      if (cast !== null) {
        k += cast[0].length;
        continue;
      }
    }
    out += ch;
    k++;
  }
  return out;
}

function applyEdits(text: string, edits: readonly Edit[]): string {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
  }
  return out;
}

/** Column definitions of a `CREATE TABLE` body. */
function createTableColumns(text: string, baseLine: number, quote: string) {
  const open = text.indexOf('(');
  const close = open === -1 ? -1 : closeParen(text, open);
  if (close === -1) return null;
  return splitTopLevel(text, open + 1, close)
    .filter((part) => !CONSTRAINT_START.test(text.slice(part.start, part.end).trim()))
    .map((part) => columnEdits(text, part.start, part.end, baseLine, quote));
}

/** Column definitions added by `ALTER TABLE … ADD [COLUMN] [IF NOT EXISTS] …`. */
function alterTableColumns(text: string, baseLine: number, quote: string) {
  const head = /^ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(ONLY\s+)?/i.exec(text);
  if (head === null) return [];
  const name = nextToken(text, head[0].length, text.length);
  if (name === null) return [];
  // A qualified name is `a.b`: skip the dot and the second part.
  let after = name.end;
  for (;;) {
    const dot = nextToken(text, after, text.length);
    if (dot?.text !== '.') break;
    after = nextToken(text, dot.end, text.length)?.end ?? dot.end;
  }
  return splitTopLevel(text, after, text.length).flatMap((part) => {
    const action = text.slice(part.start, part.end);
    const add = /^\s*ADD\s+(COLUMN\s+)?(IF\s+NOT\s+EXISTS\s+)?/i.exec(action);
    if (add === null) return [];
    const restStart = part.start + add[0].length;
    if (add[1] === undefined && CONSTRAINT_START.test(text.slice(restStart, part.end).trim())) {
      return [];
    }
    return [columnEdits(text, restStart, part.end, baseLine, quote)];
  });
}

/**
 * Rewrites a statement for the parser: casts stripped and, for `CREATE TABLE` / `ALTER TABLE`,
 * column types replaced; returns the original column types in definition order.
 */
export function prepareStatement(
  text: string,
  line: number,
  dialect: 'postgres' | 'mysql' | 'sqlite' = 'postgres',
): PreparedStatement {
  const quote = dialect === 'mysql' ? '`' : '"';
  const isCreate = /^CREATE\b/i.test(text.trimStart());
  const isAlter = /^ALTER\s+TABLE\b/i.test(text.trimStart());
  if (!isCreate && !isAlter) return { text: stripCasts(text), columns: [] };
  const isTable =
    isAlter ||
    /^CREATE\s+((TEMP|TEMPORARY|UNLOGGED|GLOBAL|LOCAL)\s+)*TABLE\b/i.test(text.trimStart());
  const found = !isTable
    ? null
    : isAlter
      ? alterTableColumns(text, line, quote)
      : createTableColumns(text, line, quote);
  if (found === null) return { text: stripCasts(text), columns: [] };
  const defined = found.filter((c) => c !== null);
  return {
    text: stripCasts(
      applyEdits(
        text,
        defined.flatMap((c) => c.edits),
      ),
    ),
    columns: defined.map((c) => c.column),
  };
}
