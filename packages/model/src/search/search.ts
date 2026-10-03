import { rawRanges, rawSnippet } from './normalize';

export interface Range {
  start: number;
  end: number;
}

export interface SearchFieldValue {
  field: SearchField;
  raw: string;
  norm: string;
}

export interface SearchEntry {
  kind: SearchKind;
  id: string;
  flowId?: string;
  title: string;
  context: string;
  fields: readonly SearchFieldValue[];
}

export interface SearchIndex {
  readonly entries: readonly SearchEntry[];
}

export type SearchKind = 'node' | 'edge' | 'flow' | 'step' | 'rule' | 'sticky';

export type SearchField =
  | 'title'
  | 'description'
  | 'type'
  | 'condition'
  | 'notes'
  | 'text'
  | 'cell'
  | 'column'
  /** A typed field value (032), indexed as "<field>: <value>". */
  | 'field';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  flowId?: string;
  title: string;
  context: string;
  match: 'title' | 'body';
  titleRanges: readonly Range[];
  snippet?: { field: SearchField; text: string; ranges: readonly Range[] };
}

const ORDER: Record<SearchKind, number> = {
  node: 0,
  edge: 1,
  flow: 2,
  step: 3,
  rule: 4,
  sticky: 5,
};

function queryWords(query: string): string[] {
  const normalized = query.trim().slice(0, 200);
  if (normalized === '') return [];
  return normalized
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[*_`]/g, '')
    .split(/\s+/u)
    .filter((word) => word !== '');
}

function titleField(entry: SearchEntry): SearchFieldValue | undefined {
  return entry.fields.find((field) => field.field === 'title');
}

function matches(entry: SearchEntry, words: readonly string[]): SearchResult | null {
  const title = titleField(entry);
  if (title === undefined) return null;
  const titleMatch = words.every((word) => title.norm.includes(word));
  const bodyFields = entry.fields.filter((field) => field.field !== 'title');
  const allMatch = words.every((word) => entry.fields.some((field) => field.norm.includes(word)));
  if (!allMatch) return null;
  const bodyField = bodyFields.find((field) => words.some((word) => field.norm.includes(word)));
  const snippet =
    titleMatch || bodyField === undefined ? undefined : rawSnippet(bodyField.raw, words);
  return {
    kind: entry.kind,
    id: entry.id,
    ...(entry.flowId === undefined ? {} : { flowId: entry.flowId }),
    title: entry.title,
    context: entry.context,
    match: titleMatch ? 'title' : 'body',
    titleRanges: rawRanges(entry.title, words),
    ...(snippet === undefined || bodyField === undefined
      ? {}
      : { snippet: { field: bodyField.field, ...snippet } }),
  };
}

export function searchDeck(
  index: SearchIndex,
  query: string,
  options: { limit?: number } = {},
): { results: readonly SearchResult[]; total: number } {
  const words = queryWords(query);
  if (words.length === 0) return { results: [], total: 0 };
  const matchesFound = index.entries
    .map((entry) => matches(entry, words))
    .filter((entry): entry is SearchResult => entry !== null)
    .sort((a, b) => {
      if (a.match !== b.match) return a.match === 'title' ? -1 : 1;
      if (ORDER[a.kind] !== ORDER[b.kind]) return ORDER[a.kind] - ORDER[b.kind];
      return a.title.localeCompare(b.title);
    });
  return {
    total: matchesFound.length,
    results: matchesFound.slice(0, options.limit ?? 50),
  };
}
