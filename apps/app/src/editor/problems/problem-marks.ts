import type { DeckProblems, Problem, Severity } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

import { problemCountLabel } from './problem-kinds';

/** What a component or connection shows for its problems (015 FR-022, FR-025). */
export interface ProblemMark {
  count: number;
  /** Tooltip: the problem titles, e.g. "Duplicate connection". */
  titles: string;
  /** For accessible names: "1 problem". */
  label: string;
  /** The worst severity among the object's problems (047). */
  severity: Severity;
  /** Table cards: column id → its worst severity, for the row glyphs. Empty for other objects. */
  rows: ReadonlyMap<Id, Severity>;
  /** Table cards: column id → the text of its problems, the row glyph's name and tooltip. */
  rowText: ReadonlyMap<Id, string>;
  /** Relationships: the pill text of the first problem that has one (`int → uuid`, `n–n`). */
  short?: string;
}

const worse = (a: Severity | undefined, b: Severity): Severity =>
  a === 'error' || b === 'error' ? 'error' : 'warning';

function markOf(id: Id, list: readonly Problem[]): ProblemMark {
  let severity: Severity = 'warning';
  const rows = new Map<Id, Severity>();
  const rowText = new Map<Id, string[]>();
  let short: string | undefined;
  for (const problem of list) {
    severity = worse(severity, problem.severity);
    if (problem.column?.tableId === id) {
      rows.set(problem.column.columnId, worse(rows.get(problem.column.columnId), problem.severity));
    }
    if (problem.column?.tableId === id) {
      const text = `${problem.title}: ${problem.detail}`;
      const known = rowText.get(problem.column.columnId);
      if (known === undefined) rowText.set(problem.column.columnId, [text]);
      else known.push(text);
    }
    short ??= problem.short;
  }
  return {
    count: list.length,
    titles: [...new Set(list.map((p) => p.title))].join(', '),
    label: problemCountLabel(list.length),
    severity,
    rows,
    rowText: new Map([...rowText].map(([column, texts]) => [column, texts.join('; ')])),
    ...(short === undefined ? {} : { short }),
  };
}

export type ProblemMarks = ReadonlyMap<Id, ProblemMark>;

export const NO_PROBLEM_MARKS: ProblemMarks = new Map();

const cache = new WeakMap<DeckProblems, ProblemMarks>();

/** Marks by object id; one map per check result, so an unchanged result keeps its identity. */
export function problemMarks(problems: DeckProblems | null): ProblemMarks {
  if (problems === null || problems.total === 0) return NO_PROBLEM_MARKS;
  let marks = cache.get(problems);
  if (marks === undefined) {
    const built = new Map<Id, ProblemMark>();
    for (const [id, list] of problems.byObject) {
      built.set(id, markOf(id, list));
    }
    marks = built;
    cache.set(problems, marks);
  }
  return marks;
}

/** Equal marks keep cached React Flow objects (`deck-to-flow.ts`). */
export function sameProblemMark(a: ProblemMark | undefined, b: ProblemMark | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return (
    a.count === b.count &&
    a.titles === b.titles &&
    a.severity === b.severity &&
    a.short === b.short &&
    sameRows(a.rows, b.rows) &&
    sameRows(a.rowText, b.rowText)
  );
}

function sameRows<T>(a: ReadonlyMap<Id, T>, b: ReadonlyMap<Id, T>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [id, value] of a) if (b.get(id) !== value) return false;
  return true;
}
