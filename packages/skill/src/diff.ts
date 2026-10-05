/**
 * Deck diff by id (027 FR-018, data-model "Deck diff"): what update mode added, changed and
 * removed. Objects are matched by id only, never by title, so a rename is one changed field and
 * a re-created object with a new id shows as removed + added: exactly what breaks a user's views
 * and notes, which is why the agent shows this before handing a file over. Pure.
 */
import type { SododeckFile } from '@sododeck/schema';

export const DIFF_COLLECTIONS = [
  'nodes',
  'groups',
  'edges',
  'views',
  'features',
  'flows',
  'rules',
  'stickies',
  'images',
] as const;

export type DiffCollection = (typeof DIFF_COLLECTIONS)[number];
export type ChangeKind = 'added' | 'changed' | 'removed';

export interface StepChange {
  id: string;
  change: ChangeKind;
  fields?: string[];
}

export interface DiffChange {
  collection: DiffCollection;
  id: string;
  change: ChangeKind;
  title?: string;
  fields?: string[];
  steps?: StepChange[];
}

export interface DeckDiff {
  report: 'sododeck-diff';
  reportVersion: 1;
  old: string;
  new: string;
  counts: Record<ChangeKind, number>;
  meta: string[];
  changes: DiffChange[];
}

type Item = Record<string, unknown> & { id: string };

const ORDER: Record<ChangeKind, number> = { added: 0, changed: 1, removed: 2 };

/** JSON with object keys sorted, so key order never counts as a change. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  skip: ReadonlySet<string>,
) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !skip.has(key) && !same(before[key], after[key])).sort();
}

function itemsOf(file: SododeckFile, collection: DiffCollection): Item[] {
  if (collection === 'rules') {
    return Object.entries(file.rules).map(([id, rule]) => ({
      ...(rule as unknown as Record<string, unknown>),
      id,
    }));
  }
  const list = (file as unknown as Record<string, unknown>)[collection];
  return Array.isArray(list) ? (list as Item[]) : [];
}

function titleOf(item: Item): string | undefined {
  if (typeof item.title === 'string') return item.title;
  if (typeof item.text === 'string') return item.text.split('\n')[0];
  return undefined;
}

function diffSteps(before: Item, after: Item): StepChange[] {
  const oldSteps = new Map(((before.steps ?? []) as Item[]).map((step) => [step.id, step]));
  const newSteps = new Map(((after.steps ?? []) as Item[]).map((step) => [step.id, step]));
  const out: StepChange[] = [];
  for (const [id, step] of newSteps) {
    const old = oldSteps.get(id);
    if (old === undefined) out.push({ id, change: 'added' });
    else {
      const fields = changedFields(old, step, new Set());
      if (fields.length > 0) out.push({ id, change: 'changed', fields });
    }
  }
  for (const id of oldSteps.keys()) if (!newSteps.has(id)) out.push({ id, change: 'removed' });
  // Order of the steps themselves is a change too, reported on the flow's `steps` field.
  return out.sort((a, b) => ORDER[a.change] - ORDER[b.change] || a.id.localeCompare(b.id));
}

const NO_SKIP = new Set<string>();
const FLOW_SKIP = new Set(['steps']);

function diffCollection(
  before: SododeckFile,
  after: SododeckFile,
  collection: DiffCollection,
): DiffChange[] {
  const oldItems = new Map(itemsOf(before, collection).map((item) => [item.id, item]));
  const newItems = new Map(itemsOf(after, collection).map((item) => [item.id, item]));
  const out: DiffChange[] = [];
  const titled = (item: Item) => {
    const title = titleOf(item);
    return title === undefined ? {} : { title };
  };
  for (const [id, item] of newItems) {
    const old = oldItems.get(id);
    if (old === undefined) {
      const steps = collection === 'flows' ? diffSteps({ id, steps: [] }, item) : [];
      out.push({
        collection,
        id,
        change: 'added',
        ...titled(item),
        ...(steps.length > 0 ? { steps } : {}),
      });
      continue;
    }
    const isFlow = collection === 'flows';
    const fields = changedFields(old, item, isFlow ? FLOW_SKIP : NO_SKIP);
    const steps = isFlow ? diffSteps(old, item) : [];
    const stepsReordered = isFlow && steps.length === 0 && !same(old.steps, item.steps);
    if (isFlow && (steps.length > 0 || stepsReordered)) fields.push('steps');
    if (fields.length === 0) continue;
    out.push({
      collection,
      id,
      change: 'changed',
      ...titled(item),
      fields: fields.sort(),
      ...(steps.length > 0 ? { steps } : {}),
    });
  }
  for (const [id, item] of oldItems) {
    if (!newItems.has(id)) out.push({ collection, id, change: 'removed', ...titled(item) });
  }
  return out.sort((a, b) => ORDER[a.change] - ORDER[b.change] || a.id.localeCompare(b.id));
}

const COLLECTION_KEYS = new Set<string>([...DIFF_COLLECTIONS, 'assets']);

/** Compares two loaded decks by id. `oldName` / `newName` label the report. */
export function diffDecks(
  before: SododeckFile,
  after: SododeckFile,
  oldName: string,
  newName: string,
): DeckDiff {
  const changes = DIFF_COLLECTIONS.flatMap((collection) =>
    diffCollection(before, after, collection),
  );
  const counts: Record<ChangeKind, number> = { added: 0, changed: 0, removed: 0 };
  for (const change of changes) counts[change.change] += 1;
  const meta = changedFields(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    COLLECTION_KEYS,
  );
  return {
    report: 'sododeck-diff',
    reportVersion: 1,
    old: oldName,
    new: newName,
    counts,
    meta,
    changes,
  };
}
