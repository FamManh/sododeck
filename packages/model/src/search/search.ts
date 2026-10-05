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
  /** A column entry's table (048); `id` is the column id. */
  tableId?: string;
  title: string;
  context: string;
  fields: readonly SearchFieldValue[];
}

export interface SearchIndex {
  readonly entries: readonly SearchEntry[];
}

export type SearchKind =
  'node' | 'table' | 'column' | 'edge' | 'flow' | 'step' | 'rule' | 'sticky' | 'image';

export type SearchField =
  | 'title'
  | 'description'
  | 'type'
  | 'condition'
  | 'notes'
  | 'text'
  | 'cell'
  | 'column'
  /** A sticky note's tag (053). */
  | 'tag'
  /** An image's alt text, caption and original file name (055). */
  | 'alt'
  | 'caption'
  | 'file'
  /** A typed field value (032), indexed as "<field>: <value>". */
  | 'field';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  flowId?: string;
  tableId?: string;
  title: string;
  context: string;
  match: 'title' | 'body';
  titleRanges: readonly Range[];
  snippet?: { field: SearchField; text: string; ranges: readonly Range[] };
}

// Same order as `localeCompare`, without its per-call cost on thousands of hits.
const COLLATOR = new Intl.Collator();

const ORDER: Record<SearchKind, number> = {
  node: 0,
  table: 1,
  column: 2,
  edge: 3,
  flow: 4,
  step: 5,
  rule: 6,
  sticky: 7,
  image: 8,
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

/** What sorting needs of a hit, so result objects (ranges, snippets) are built for the top only. */
interface Hit {
  entry: SearchEntry;
  titleMatch: boolean;
}

function hitOf(entry: SearchEntry, words: readonly string[]): Hit | null {
  const title = titleField(entry);
  if (title === undefined) return null;
  if (!words.every((word) => entry.fields.some((field) => field.norm.includes(word)))) return null;
  return { entry, titleMatch: words.every((word) => title.norm.includes(word)) };
}

function resultOf(hit: Hit, words: readonly string[]): SearchResult {
  const { entry, titleMatch } = hit;
  const bodyField = entry.fields.find(
    (field) => field.field !== 'title' && words.some((word) => field.norm.includes(word)),
  );
  const snippet =
    titleMatch || bodyField === undefined ? undefined : rawSnippet(bodyField.raw, words);
  return {
    kind: entry.kind,
    id: entry.id,
    ...(entry.flowId === undefined ? {} : { flowId: entry.flowId }),
    ...(entry.tableId === undefined ? {} : { tableId: entry.tableId }),
    title: entry.title,
    context: entry.context,
    match: titleMatch ? 'title' : 'body',
    titleRanges: rawRanges(entry.title, words),
    ...(snippet === undefined || bodyField === undefined
      ? {}
      : { snippet: { field: bodyField.field, ...snippet } }),
  };
}

/**
 * Finds `query` in the index. `results` holds the best `limit` (default 50); `total` counts every
 * match, so the caller can say "n more" (048 FR-023). Hits are ranked from cheap keys first and
 * only the returned ones get title ranges and snippets, so 10,000 matches cost one sort.
 */
export function searchDeck(
  index: SearchIndex,
  query: string,
  options: { limit?: number } = {},
): { results: readonly SearchResult[]; total: number } {
  const words = queryWords(query);
  if (words.length === 0) return { results: [], total: 0 };
  const hits: Hit[] = [];
  for (const entry of index.entries) {
    const hit = hitOf(entry, words);
    if (hit !== null) hits.push(hit);
  }
  hits.sort((a, b) => {
    if (a.titleMatch !== b.titleMatch) return a.titleMatch ? -1 : 1;
    if (ORDER[a.entry.kind] !== ORDER[b.entry.kind]) {
      return ORDER[a.entry.kind] - ORDER[b.entry.kind];
    }
    return COLLATOR.compare(a.entry.title, b.entry.title);
  });
  return {
    total: hits.length,
    results: hits.slice(0, options.limit ?? 50).map((hit) => resultOf(hit, words)),
  };
}
