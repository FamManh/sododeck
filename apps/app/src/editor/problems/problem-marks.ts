import type { DeckProblems } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

import { problemCountLabel } from './problem-kinds';

/** What a component or connection shows for its problems (015 FR-022, FR-025). */
export interface ProblemMark {
  count: number;
  /** Tooltip: the problem titles, e.g. "Orphan component". */
  titles: string;
  /** For accessible names: "1 problem". */
  label: string;
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
      built.set(id, {
        count: list.length,
        titles: [...new Set(list.map((p) => p.title))].join(', '),
        label: problemCountLabel(list.length),
      });
    }
    marks = built;
    cache.set(problems, marks);
  }
  return marks;
}

/** Equal marks keep cached React Flow objects (`deck-to-flow.ts`). */
export function sameProblemMark(a: ProblemMark | undefined, b: ProblemMark | undefined): boolean {
  return a === b || (a?.count === b?.count && a?.titles === b?.titles);
}
