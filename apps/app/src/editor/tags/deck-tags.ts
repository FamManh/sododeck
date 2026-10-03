/**
 * Tags of a deck, derived from the document (033, data-model.md): never stored, so the picker, the
 * drawer and the canvas cannot disagree with the file. A tag is its text matched by `tagKey`
 * (case and spacing ignored); the text keeps the case it was typed in.
 */
import { tagKey } from '@sododeck/model';
import type { ColorRef, SododeckFile } from '@sododeck/schema';

/** One tag of the deck, as the picker lists it. */
export interface DeckTag {
  /** Display spelling: the `tagColors` key if there is one, else the first spelling on a card. */
  tag: string;
  key: string;
  /** Cards carrying the tag. */
  count: number;
  color?: ColorRef;
}

/** How many objects of each kind carry a tag, for confirmation lines. */
export interface TagUsage {
  cards: number;
  connections: number;
  flows: number;
  steps: number;
  /** Whether the deck's own tags hold it. */
  deckTag: boolean;
}

const has = (tags: readonly string[] | undefined, key: string): boolean =>
  tags?.some((tag) => tagKey(tag) === key) ?? false;

/** The stored colour entry of a tag, with the spelling it is stored under. */
function colourEntries(deck: SododeckFile): Map<string, { tag: string; color: ColorRef }> {
  const entries = new Map<string, { tag: string; color: ColorRef }>();
  for (const [tag, color] of Object.entries(deck.tagColors ?? {})) {
    entries.set(tagKey(tag), { tag, color });
  }
  return entries;
}

/**
 * Every tag held by a card or given a colour, most used first, then by name ignoring case. A
 * coloured tag no card carries stays listed with a count of 0 until it is deleted.
 */
export function deckTags(deck: SododeckFile): DeckTag[] {
  const colours = colourEntries(deck);
  const found = new Map<string, DeckTag>();
  for (const node of deck.nodes) {
    const seenOnCard = new Set<string>();
    for (const text of node.tags ?? []) {
      const key = tagKey(text);
      if (key === '' || seenOnCard.has(key)) continue;
      seenOnCard.add(key);
      const entry = found.get(key);
      if (entry === undefined) {
        const colour = colours.get(key);
        found.set(key, {
          tag: colour?.tag ?? text.trim().replace(/\s+/g, ' '),
          key,
          count: 1,
          ...(colour ? { color: colour.color } : {}),
        });
      } else {
        entry.count += 1;
      }
    }
  }
  for (const [key, colour] of colours) {
    if (!found.has(key)) found.set(key, { tag: colour.tag, key, count: 0, color: colour.color });
  }
  return [...found.values()].sort(
    (a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

/** How many cards, connections, flows and steps carry `tag` (matched by key), and the deck itself. */
export function tagUsage(deck: SododeckFile, tag: string): TagUsage {
  const key = tagKey(tag);
  let steps = 0;
  for (const flow of deck.flows) steps += flow.steps.filter((step) => has(step.tags, key)).length;
  return {
    cards: deck.nodes.filter((node) => has(node.tags, key)).length,
    connections: deck.edges.filter((edge) => has(edge.tags, key)).length,
    flows: deck.flows.filter((flow) => has(flow.tags, key)).length,
    steps,
    deckTag: has(deck.tags, key),
  };
}

/**
 * The text to write when `typed` is added as a tag: the existing spelling when the key is already
 * in the deck (colour key first, then cards, connections, flows, steps and the deck's tags), else
 * the typed text trimmed and single-spaced with its case kept. `null` for empty text.
 */
export function canonicalTag(deck: SododeckFile, typed: string): string | null {
  const text = typed.trim().replace(/\s+/g, ' ');
  if (text === '') return null;
  const key = tagKey(text);
  const coloured = colourEntries(deck).get(key);
  if (coloured !== undefined) return coloured.tag;
  const pick = (tags: readonly string[] | undefined): string | undefined =>
    tags
      ?.find((tag) => tagKey(tag) === key)
      ?.trim()
      .replace(/\s+/g, ' ');
  for (const node of deck.nodes) {
    const found = pick(node.tags);
    if (found !== undefined) return found;
  }
  for (const edge of deck.edges) {
    const found = pick(edge.tags);
    if (found !== undefined) return found;
  }
  for (const flow of deck.flows) {
    const found = pick(flow.tags);
    if (found !== undefined) return found;
  }
  for (const flow of deck.flows) {
    for (const step of flow.steps) {
      const found = pick(step.tags);
      if (found !== undefined) return found;
    }
  }
  return pick(deck.tags) ?? text;
}
