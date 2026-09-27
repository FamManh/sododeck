/**
 * Flow list filter (FR-034, research R12): case-insensitive over flow titles, step titles, the
 * connection labels of steps, and step and branch conditions. Pure; 20 flows × 10 steps is far
 * below a millisecond, so it runs on every keystroke.
 */
import type { SododeckFile } from '@sododeck/schema';

/** Half-open [start, end) ranges of matching text. */
export type Range = readonly [number, number];

export interface FieldMatch {
  kind: 'step title' | 'connection label' | 'step condition' | 'branch condition';
  text: string;
  ranges: readonly Range[];
}

export interface FlowMatch {
  /** Matches in the flow title (highlighted in the list). */
  title: readonly Range[];
  /** Other matching fields, in step order. */
  fields: readonly FieldMatch[];
}

export interface FilterResult {
  /** Matching flows; every flow when the query is empty. */
  matches: ReadonlyMap<string, FlowMatch>;
  count: number;
  total: number;
}

/** Every occurrence of `query` in `text`, ignoring case. */
export function findRanges(text: string, query: string): Range[] {
  const needle = query.toLowerCase();
  if (needle === '') return [];
  const haystack = text.toLowerCase();
  const out: Range[] = [];
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    out.push([at, at + needle.length]);
    at = haystack.indexOf(needle, at + needle.length);
  }
  return out;
}

export function filterFlows(deck: SododeckFile, query: string): FilterResult {
  const q = query.trim();
  const total = deck.flows.length;
  const matches = new Map<string, FlowMatch>();
  if (q === '') {
    for (const flow of deck.flows) matches.set(flow.id, { title: [], fields: [] });
    return { matches, count: total, total };
  }
  const labels = new Map(deck.edges.map((e) => [e.id, e.label]));
  for (const flow of deck.flows) {
    const fields: FieldMatch[] = [];
    const add = (kind: FieldMatch['kind'], text: string | undefined) => {
      if (text === undefined) return;
      const ranges = findRanges(text, q);
      if (ranges.length > 0) fields.push({ kind, text, ranges });
    };
    for (const step of flow.steps) {
      add('step title', step.title);
      add('connection label', labels.get(step.edge));
      add('step condition', step.condition);
    }
    for (const branch of flow.branches ?? []) add('branch condition', branch.condition);
    const title = findRanges(flow.title, q);
    if (title.length > 0 || fields.length > 0) matches.set(flow.id, { title, fields });
  }
  return { matches, count: matches.size, total };
}
