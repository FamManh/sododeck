/**
 * The column line (043, research R1 and R2, contracts/column-line.md): one line of text such as
 * `price numeric(10,2) not null default 0` stands for a column. Pure functions that parse a line
 * (with token ranges for the chips), write a column back as a line, turn a parsed line into one
 * `updateColumn` patch and check the name. They run on every keystroke, so a hand-written
 * tokenizer does the work in one pass with no dependency.
 */
import type { NewDbColumn, Patch } from '@sododeck/model';
import type { DbColumn, DbEnum, Id, Node } from '@sododeck/schema';

export interface LineToken {
  kind: 'name' | 'type' | 'flag' | 'default' | 'ignored';
  /** The text as written, a slice of the line from `from` to `to`. */
  text: string;
  from: number;
  to: number;
}

export interface ParsedColumnLine {
  /** `''` when missing. Quotes are not part of it. */
  name: string;
  /** As written, without the size. Absent for a name-only line. */
  type?: string;
  /** `'10'` or `'10,2'`. */
  size?: string;
  /** Set when `type` names a deck enum. */
  enumRef?: Id;
  pk?: true;
  notNull?: true;
  unique?: true;
  increment?: true;
  default?: string | number | boolean;
  defaultExpr?: string;
  /** In text order, for the chips. */
  tokens: LineToken[];
  /** Words not understood (FR-004). */
  ignored: string[];
  hints: string[];
}

export type LineError = 'empty' | 'taken';

/**
 * The type stored for a name-only line. The file format needs a non-empty type, and a single
 * space is what a blank type already looks like in decks (045's edge cases); it reads as "no
 * type" everywhere (`type.trim() === ''`).
 */
export const NO_TYPE = ' ';

/** The model's only size form: a length, or precision and scale (research R1). */
const SIZE = /^\d{1,6}(,\d{1,6})?$/;
/** Splits `numeric(10,2)` into type and size, as `db/export/common-types.ts` `translateType` does. */
const TYPE_WITH_SIZE = /^(.*?)\s*\(([^()]*)\)$/;
const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
/** A name or type that can be written without quotes. */
const BARE = /^[^\s"'()]+$/;
const DEFAULT_HINT = 'default needs a value';

interface RawToken {
  from: number;
  to: number;
  /** The unquoted value for a quoted token, else the text. */
  value: string;
  quoted: boolean;
}

const isSpace = (ch: string | undefined) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
const isQuote = (ch: string | undefined) => ch === '"' || ch === "'";

/** The index just past the quoted run starting at `start`, and its unescaped value (`''` → `'`). */
function readQuoted(text: string, start: number): { end: number; value: string } {
  const quote = text[start];
  let value = '';
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === undefined) break;
    if (ch === quote) {
      if (text[i + 1] === quote) {
        value += ch;
        i += 2;
        continue;
      }
      return { end: i + 1, value };
    }
    value += ch;
    i += 1;
  }
  // Unterminated: the rest of the line, so a quote being typed does not jump the chips around.
  return { end: i, value };
}

/** The index just past the balanced parenthesised run starting at `start` (quotes respected). */
function skipGroup(text: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (isQuote(ch)) {
      i = readQuoted(text, i).end;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return i;
}

/** Words, quoted runs, and words with parentheses (`numeric(10, 2)`, `now()`) as one token. */
function tokenize(text: string): RawToken[] {
  const tokens: RawToken[] = [];
  let i = 0;
  while (i < text.length) {
    if (isSpace(text[i])) {
      i += 1;
      continue;
    }
    const from = i;
    if (isQuote(text[i])) {
      const { end, value } = readQuoted(text, i);
      tokens.push({ from, to: end, value, quoted: true });
      i = end;
      continue;
    }
    while (i < text.length && !isSpace(text[i])) {
      i = text[i] === '(' ? skipGroup(text, i) : i + 1;
    }
    tokens.push({ from, to: i, value: text.slice(from, i), quoted: false });
  }
  return tokens;
}

/** The deck enum a type names: its `name` or `schema.name`, ignoring case. */
function enumNamed(type: string, enums: readonly DbEnum[]): DbEnum | undefined {
  const key = type.toLowerCase();
  return enums.find(
    (e) =>
      e.name.toLowerCase() === key ||
      (e.schema !== undefined && `${e.schema}.${e.name}`.toLowerCase() === key),
  );
}

/** A keyword token (never a quoted one), lower-cased. */
const keyword = (t: RawToken | undefined) =>
  t === undefined || t.quoted ? '' : t.value.toLowerCase();

const normalised = (text: string) => text.toLowerCase().replace(/\s+/g, ' ');
const isNullFlag = (t: LineToken) =>
  t.kind === 'flag' && (normalised(t.text) === 'null' || normalised(t.text) === 'not null');

export function parseColumnLine(text: string, ctx: { enums: readonly DbEnum[] }): ParsedColumnLine {
  const raw = tokenize(text);
  const result: ParsedColumnLine = { name: '', tokens: [], ignored: [], hints: [] };
  let tokens: LineToken[] = [];
  const slice = (from: number, to: number) => text.slice(from, to);
  const push = (kind: LineToken['kind'], from: number, to: number) => {
    tokens.push({ kind, text: slice(from, to), from, to });
  };
  const ignore = (t: RawToken) => {
    push('ignored', t.from, t.to);
    result.ignored.push(slice(t.from, t.to));
  };

  const nameToken = raw[0];
  if (nameToken === undefined) return result;
  result.name = nameToken.value;
  push('name', nameToken.from, nameToken.to);

  // The second word is always the type, whatever it says (contract rule 1).
  const typeToken = raw[1];
  if (typeToken !== undefined) {
    let type: string | undefined;
    let size: string | undefined;
    let valid = true;
    if (typeToken.quoted) {
      // `""` is the placeholder that keeps a blank type in front of the modifiers.
      type = typeToken.value.trim() === '' ? undefined : typeToken.value;
    } else if (/[()]/.test(typeToken.value)) {
      const match = TYPE_WITH_SIZE.exec(typeToken.value);
      const base = match?.[1] ?? '';
      const written = (match?.[2] ?? '').replace(/\s+/g, '');
      valid = base !== '' && !/[()]/.test(base) && SIZE.test(written);
      if (valid) {
        type = base;
        size = written;
      }
    } else {
      type = typeToken.value;
    }
    if (valid) {
      push('type', typeToken.from, typeToken.to);
      if (type !== undefined) {
        result.type = type;
        const linked = enumNamed(type, ctx.enums);
        if (linked !== undefined) result.enumRef = linked.id;
      }
      if (size !== undefined) result.size = size;
    } else {
      ignore(typeToken);
    }
  }

  let i = 2;
  while (i < raw.length) {
    const t = raw[i];
    if (t === undefined) break;
    const word = keyword(t);
    const next = raw[i + 1];
    if (word === 'pk') {
      result.pk = true;
      push('flag', t.from, t.to);
    } else if (word === 'primary' && keyword(next) === 'key' && next !== undefined) {
      result.pk = true;
      push('flag', t.from, next.to);
      i += 1;
    } else if (word === 'not' && keyword(next) === 'null' && next !== undefined) {
      // The last of `null` / `not null` wins, and only its chip shows.
      tokens = tokens.filter((x) => !isNullFlag(x));
      result.notNull = true;
      push('flag', t.from, next.to);
      i += 1;
    } else if (word === 'null') {
      tokens = tokens.filter((x) => !isNullFlag(x));
      delete result.notNull;
      push('flag', t.from, t.to);
    } else if (word === 'unique') {
      result.unique = true;
      push('flag', t.from, t.to);
    } else if (word === 'increment' || word === 'auto_increment' || word === 'autoincrement') {
      result.increment = true;
      push('flag', t.from, t.to);
    } else if (word === 'default') {
      if (next === undefined) {
        result.hints.push(DEFAULT_HINT);
        ignore(t);
      } else {
        tokens = tokens.filter((x) => x.kind !== 'default');
        delete result.default;
        delete result.defaultExpr;
        readDefault(next, result);
        push('default', t.from, next.to);
        i += 1;
      }
    } else {
      ignore(t);
    }
    i += 1;
  }

  result.tokens = tokens;
  return result;
}

/** A default value: quoted text, a number or a boolean is data; `null` is none; else an expression. */
function readDefault(t: RawToken, result: ParsedColumnLine): void {
  if (t.quoted) {
    result.default = t.value;
    return;
  }
  const word = t.value.toLowerCase();
  if (word === 'null') return;
  if (word === 'true' || word === 'false') result.default = word === 'true';
  else if (NUMBER.test(t.value) && Number.isFinite(Number(t.value)))
    result.default = Number(t.value);
  else result.defaultExpr = t.value;
}

/** The caret offset where the type starts (Tab from the name), when the line has a type token. */
export function typeTokenStart(parsed: ParsedColumnLine): number | undefined {
  return parsed.tokens.find((t) => t.kind === 'type')?.from;
}

const quoteName = (text: string) => (BARE.test(text) ? text : `"${text.replace(/"/g, '""')}"`);
const quoteString = (text: string) => `'${text.replace(/'/g, "''")}'`;

/** The type text to write: the column's own, or its enum's name when the stored text no longer names it. */
function typeTextOf(column: DbColumn, enums: readonly DbEnum[]): string {
  if (column.enumRef === undefined) return column.type;
  const linked = enums.find((e) => e.id === column.enumRef);
  if (linked === undefined || enumNamed(column.type, enums)?.id === linked.id) return column.type;
  return linked.schema === undefined ? linked.name : `${linked.schema}.${linked.name}`;
}

export function formatColumnLine(column: DbColumn, enums: readonly DbEnum[]): string {
  const rest: string[] = [];
  if (column.pk === true) rest.push('pk');
  if (column.notNull === true && column.pk !== true) rest.push('not null');
  if (column.unique === true) rest.push('unique');
  if (column.increment === true) rest.push('increment');
  if (column.default !== undefined) {
    rest.push(
      `default ${typeof column.default === 'string' ? quoteString(column.default) : String(column.default)}`,
    );
  } else if (column.defaultExpr !== undefined) {
    rest.push(`default ${column.defaultExpr}`);
  }

  const parts = [quoteName(column.name)];
  const type = typeTextOf(column, enums);
  if (type.trim() === '') {
    // Without a placeholder the first modifier would be read as the type.
    if (rest.length > 0) parts.push('""');
  } else if (BARE.test(type)) {
    parts.push(column.size === undefined ? type : `${type}(${column.size})`);
  } else {
    parts.push(`"${type.replace(/"/g, '""')}"`);
  }
  return [...parts, ...rest].join(' ');
}

type LineValues = Omit<DbColumn, 'id' | 'note' | 'check'>;

/** The column fields a parsed line states, with no nulls. */
function lineValues(parsed: ParsedColumnLine): LineValues {
  const values: LineValues = { name: parsed.name, type: parsed.type ?? NO_TYPE };
  if (parsed.size !== undefined) values.size = parsed.size;
  if (parsed.pk === true) values.pk = true;
  if (parsed.notNull === true) values.notNull = true;
  if (parsed.unique === true) values.unique = true;
  if (parsed.increment === true) values.increment = true;
  if (parsed.default !== undefined) values.default = parsed.default;
  if (parsed.defaultExpr !== undefined) values.defaultExpr = parsed.defaultExpr;
  if (parsed.enumRef !== undefined) values.enumRef = parsed.enumRef;
  return values;
}

/** The data `editor.addColumn` takes for a new row. */
export function newColumnData(parsed: ParsedColumnLine): NewDbColumn {
  return lineValues(parsed);
}

/**
 * One `updateColumn` patch for an edited row (R2): every field the line states, and `null` for
 * every line field the column had but the line no longer has (so `default` and `defaultExpr`
 * never both stay, S14). `note`, `check` and `id` are never touched.
 */
export function columnLinePatch(
  previous: DbColumn | undefined,
  parsed: ParsedColumnLine,
): Patch<DbColumn> {
  const values = lineValues(parsed);
  const patch: Patch<DbColumn> = { ...values };
  if (previous === undefined) return patch;
  const clear = (key: 'size' | 'pk' | 'unique' | 'increment' | 'default' | 'defaultExpr') => {
    if (values[key] === undefined && previous[key] !== undefined) patch[key] = null;
  };
  clear('size');
  clear('pk');
  clear('unique');
  clear('increment');
  clear('default');
  clear('defaultExpr');

  // The line hides `not null` on a key column, so a key line without an explicit `null` keeps it.
  const explicitNull = parsed.tokens.some(
    (t) => t.kind === 'flag' && normalised(t.text) === 'null',
  );
  const keyHidesNotNull = parsed.pk === true && !explicitNull;
  if (values.notNull === undefined && previous.notNull !== undefined && !keyHidesNotNull) {
    patch.notNull = null;
  }

  // A link to an enum the deck no longer has stays while the type still names it.
  const sameType = parsed.type?.trim().toLowerCase() === previous.type.trim().toLowerCase();
  if (values.enumRef === undefined && previous.enumRef !== undefined && !sameType) {
    patch.enumRef = null;
  }
  return patch;
}

/** `empty` for a blank name; `taken` when another column of the table has it (any case). */
export function lineError(
  parsed: ParsedColumnLine,
  table: Pick<Node, 'columns'>,
  exceptId?: Id,
): LineError | null {
  const name = parsed.name.trim();
  if (name === '') return 'empty';
  const key = parsed.name.toLowerCase();
  const taken = (table.columns ?? []).some(
    (c) => c.id !== exceptId && c.name.toLowerCase() === key,
  );
  return taken ? 'taken' : null;
}

/** The inline message under the line for a `lineError`. */
export function lineErrorText(error: LineError, name: string): string {
  return error === 'empty' ? 'Type a column name' : `A column named ${name} already exists`;
}
