/**
 * Deck-wide tag operations (033, ADR 0022). A tag is its text, matched by `tagKey`; its colour
 * lives in `meta.tagColors` (tag → colour). Each op is one transaction and one undo step.
 */
import type { ColorRef } from '@sododeck/schema';
import * as Y from 'yjs';

import { toY, type YObject, type YValue } from '../convert';
import { DeckEditError } from '../errors';
import {
  childList,
  collectionMap,
  metaMap,
  orderedEntries,
  tagColorsMap,
  type ListMap,
} from '../layout';
import { tagKey } from '../tags';
import { assertValid, validateObject } from '../validate';
import type { EditContext } from './context';

/** The tag text as stored: trimmed and single-spaced, in the case it was given. */
export function tidy(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** The map attached to the document, creating it if a stored document predates it. */
function attachedTagColors(ctx: EditContext): Y.Map<string> {
  const meta = metaMap(ctx.doc);
  if (!(meta.get('tagColors') instanceof Y.Map)) meta.set('tagColors', new Y.Map<YValue>());
  return tagColorsMap(ctx.doc);
}

/** The spelling a tag's colour is stored under, if it has one. */
function storedSpelling(ctx: EditContext, key: string): string | undefined {
  for (const spelling of tagColorsMap(ctx.doc).keys()) {
    if (tagKey(spelling) === key) return spelling;
  }
  return undefined;
}

/**
 * Sets (`color`) or clears (`null`) a tag's colour. The entry keeps the spelling it already has,
 * so "pic" colours "PIC" when that is the stored key. Does nothing, and writes no transaction,
 * when the colour is already as asked. `invalid` for an empty tag or a colour that is not a card
 * colour name or `#rrggbb`.
 */
export function setTagColor(ctx: EditContext, tag: string, color: ColorRef | null): void {
  const key = tagKey(tag);
  const existing = key === '' ? undefined : storedSpelling(ctx, key);

  if (color === null) {
    if (existing === undefined) return;
    ctx.transact(() => {
      tagColorsMap(ctx.doc).delete(existing);
    });
    return;
  }

  if (key === '') {
    throw new DeckEditError('invalid', [{ path: 'tagColors', message: 'A tag cannot be empty.' }]);
  }
  const spelling = existing ?? tidy(tag);
  assertValid(validateObject('meta', { tagColors: { [spelling]: color } }));
  if (tagColorsMap(ctx.doc).get(spelling) === color) return;
  ctx.transact(() => {
    attachedTagColors(ctx).set(spelling, color);
  });
}

/** What a tag op changed: cards, sticky notes, and every other object (connections, flows, …). */
export interface TagChange {
  /** Components whose tags changed. */
  cards: number;
  /** Sticky notes whose tags changed (053). */
  notes: number;
  /** Connections, flows, steps, the deck's own tags and view filters that changed. */
  others: number;
}

/** `tags` of a stored object, or `undefined` when it has none. */
function tagsOfMap(map: YObject, field: 'tags' | 'excludeTags'): string[] | undefined {
  const stored = map.get(field);
  return stored instanceof Y.Array ? (stored.toArray() as string[]) : undefined;
}

/** The same tags with `rewrite` applied; arrays that end up equal are left alone. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}

/**
 * Applies `rewrite` to the tags of every carrier and writes the arrays that change. Returns the
 * counts; with `write` false it only counts (a dry run that still validates). Each new array is
 * validated first (the `meta` schema holds the same `Tags` rule). Write inside a transaction.
 */
function rewriteCarriers(
  ctx: EditContext,
  rewrite: (tags: readonly string[]) => string[],
  write: boolean,
): TagChange {
  const change: TagChange = { cards: 0, notes: 0, others: 0 };
  const apply = (
    map: YObject,
    field: 'tags' | 'excludeTags',
    kind: 'cards' | 'notes' | 'others',
  ) => {
    const before = tagsOfMap(map, field);
    if (before === undefined) return;
    const after = rewrite(before);
    if (sameList(before, after)) return;
    assertValid(validateObject('meta', { tags: after }));
    if (write) {
      if (after.length === 0) map.delete(field);
      else map.set(field, toY(after));
    }
    change[kind] += 1;
  };
  const eachItem = (list: ListMap, fn: (item: YObject) => void) => {
    for (const [, item] of orderedEntries(list)) fn(item);
  };
  eachItem(collectionMap(ctx.doc, 'nodes'), (m) => {
    apply(m, 'tags', 'cards');
  });
  eachItem(collectionMap(ctx.doc, 'stickies'), (m) => {
    apply(m, 'tags', 'notes');
  });
  eachItem(collectionMap(ctx.doc, 'edges'), (m) => {
    apply(m, 'tags', 'others');
  });
  eachItem(collectionMap(ctx.doc, 'flows'), (flow) => {
    apply(flow, 'tags', 'others');
    const steps = childList(flow, 'steps');
    if (steps !== undefined) {
      eachItem(steps, (step) => {
        apply(step, 'tags', 'others');
      });
    }
  });
  apply(metaMap(ctx.doc), 'tags', 'others');
  eachItem(collectionMap(ctx.doc, 'views'), (view) => {
    apply(view, 'excludeTags', 'others');
  });
  return change;
}

/** Every tag key the deck holds with the first spelling found (colours, then objects). */
function spellings(ctx: EditContext): Map<string, string> {
  const found = new Map<string, string>();
  const note = (text: string) => {
    const key = tagKey(text);
    if (key !== '' && !found.has(key)) found.set(key, tidy(text));
  };
  for (const key of tagColorsMap(ctx.doc).keys()) note(key);
  const noteAll = (map: YObject, field: 'tags' | 'excludeTags' = 'tags') => {
    tagsOfMap(map, field)?.forEach(note);
  };
  for (const [, m] of orderedEntries(collectionMap(ctx.doc, 'nodes'))) noteAll(m);
  for (const [, m] of orderedEntries(collectionMap(ctx.doc, 'stickies'))) noteAll(m);
  for (const [, m] of orderedEntries(collectionMap(ctx.doc, 'edges'))) noteAll(m);
  for (const [, flow] of orderedEntries(collectionMap(ctx.doc, 'flows'))) {
    noteAll(flow);
    const steps = childList(flow, 'steps');
    if (steps !== undefined) for (const [, step] of orderedEntries(steps)) noteAll(step);
  }
  noteAll(metaMap(ctx.doc));
  return found;
}

/** Keeps the first of each key, in order. */
function uniqueByKey(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tagKey(tag);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Renames a tag everywhere (033): every card, sticky note (053), connection, flow, step, the deck's tags and every
 * view's hidden tags, and the colour entry, in one transaction. A new key that another tag
 * already has merges onto that tag's spelling and colour; the same key with another case only
 * respells. Lists lose repeats (first position kept), so no card ends with more tags than before.
 * `invalid` when `to` is empty. No change event when nothing changes.
 */
export function renameTag(ctx: EditContext, from: string, to: string): TagChange {
  const target = tidy(to);
  const toKey = tagKey(target);
  if (toKey === '') {
    throw new DeckEditError('invalid', [{ path: 'tags', message: 'A tag name cannot be empty.' }]);
  }
  const fromKey = tagKey(from);
  const known = spellings(ctx);
  const merging = toKey !== fromKey && known.has(toKey);
  const spelling = merging ? (known.get(toKey) ?? target) : target;
  const colours = tagColorsMap(ctx.doc);
  const fromColourKey = storedSpelling(ctx, fromKey);

  const rewrite = (tags: readonly string[]) =>
    uniqueByKey(
      tags.map((tag) => (tagKey(tag) === fromKey || tagKey(tag) === toKey ? spelling : tag)),
    );
  // A merged tag keeps the colour of the tag it joins; a moved one takes its colour along.
  const colourChanges = merging
    ? fromColourKey !== undefined
    : fromColourKey !== undefined && fromColourKey !== spelling;
  const preview = rewriteCarriers(ctx, rewrite, false);
  if (preview.cards + preview.others === 0 && !colourChanges) return preview;

  let change = preview;
  ctx.transact(() => {
    change = rewriteCarriers(ctx, rewrite, true);
    if (fromColourKey === undefined) return;
    const colour = colours.get(fromColourKey);
    colours.delete(fromColourKey);
    if (!merging && colour !== undefined) attachedTagColors(ctx).set(spelling, colour);
  });
  return change;
}

/**
 * Deletes a tag everywhere (033): from every card, sticky note (053), connection, flow, step, the deck's tags and
 * every view's hidden tags, and drops its colour entry, in one transaction. A list that ends up
 * empty is removed. An absent tag does nothing and returns zero counts.
 */
export function deleteTag(ctx: EditContext, tag: string): TagChange {
  const key = tagKey(tag);
  const none: TagChange = { cards: 0, notes: 0, others: 0 };
  if (key === '') return none;
  const coloured = storedSpelling(ctx, key);
  const drop = (tags: readonly string[]) => tags.filter((t) => tagKey(t) !== key);
  if (coloured === undefined && !spellings(ctx).has(key)) return none;
  let change = none;
  ctx.transact(() => {
    change = rewriteCarriers(ctx, drop, true);
    if (coloured !== undefined) tagColorsMap(ctx.doc).delete(coloured);
  });
  return change;
}
