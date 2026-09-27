/**
 * Condition cells of a decision table (ADR 0009): what a cell's text means and whether an input
 * satisfies it. Pure; cells keep the user's text, parsing never rewrites it.
 */

export type CompareOp = '<' | '<=' | '>' | '>=';

export type Cell =
  | { kind: 'any' }
  | { kind: 'compare'; op: CompareOp; value: number }
  | { kind: 'exact'; value: string }
  | { kind: 'list'; values: readonly string[] }
  | { kind: 'invalid' };

const NUMBER = /^-?\d+(\.\d+)?$/;
const OPERATOR = /^(<=|>=|≤|≥|<|>)\s*(.*)$/;
const OPS: Readonly<Record<string, CompareOp>> = {
  '<': '<',
  '<=': '<=',
  '≤': '<=',
  '>': '>',
  '>=': '>=',
  '≥': '>=',
};

const ANY: Cell = { kind: 'any' };
const INVALID: Cell = { kind: 'invalid' };

/** The number a trimmed text spells in the cell grammar, or undefined. */
function toNumber(text: string): number | undefined {
  return NUMBER.test(text) ? Number(text) : undefined;
}

/** Parses one condition cell. `≤`/`≥` normalize to `<=`/`>=`. */
export function parseCell(text: string): Cell {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'any') return ANY;
  const comparison = OPERATOR.exec(trimmed);
  if (comparison !== null) {
    const op = OPS[comparison[1] ?? ''];
    const value = toNumber(comparison[2] ?? '');
    return op === undefined || value === undefined ? INVALID : { kind: 'compare', op, value };
  }
  if (trimmed.includes(',')) {
    const values = trimmed.split(',').map((item) => item.trim());
    return values.some((v) => v === '' || OPERATOR.test(v)) ? INVALID : { kind: 'list', values };
  }
  return { kind: 'exact', value: trimmed };
}

function equalsExact(expected: string, input: string): boolean {
  const a = toNumber(expected);
  const b = toNumber(input);
  if (a !== undefined && b !== undefined) return a === b;
  return expected.toLowerCase() === input.toLowerCase();
}

/** Does `input` satisfy `cell`? An empty input only matches `any`; `invalid` never matches. */
export function matchCell(cell: Cell, input: string): boolean {
  if (cell.kind === 'any') return true;
  const value = input.trim();
  if (value === '') return false;
  switch (cell.kind) {
    case 'compare': {
      const n = toNumber(value);
      if (n === undefined) return false;
      switch (cell.op) {
        case '<':
          return n < cell.value;
        case '<=':
          return n <= cell.value;
        case '>':
          return n > cell.value;
        case '>=':
          return n >= cell.value;
      }
      break;
    }
    case 'exact':
      return equalsExact(cell.value, value);
    case 'list':
      return cell.values.some((item) => equalsExact(item, value));
    case 'invalid':
      return false;
  }
}
