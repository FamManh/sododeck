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
 * Every tag key the deck holds, with the spelling to show and to write: the colour key first, then
 * the first spelling on a card, a connection, a flow, a step and the deck's own tags.
 */
export function tagSpellings(deck: SododeckFile): Map<string, string> {
  const spellings = new Map<string, string>();
  const note = (text: string) => {
    const key = tagKey(text);
    if (key !== '' && !spellings.has(key)) spellings.set(key, text.trim().replace(/\s+/g, ' '));
  };
  for (const { tag } of colourEntries(deck).values()) note(tag);
  for (const node of deck.nodes) node.tags?.forEach(note);
  for (const edge of deck.edges) edge.tags?.forEach(note);
  for (const flow of deck.flows) flow.tags?.forEach(note);
  for (const flow of deck.flows) for (const step of flow.steps) step.tags?.forEach(note);
  deck.tags?.forEach(note);
  return spellings;
}

/**
 * The text to write when `typed` is added as a tag: the existing spelling when the key is already
 * in the deck (see `tagSpellings`), else the typed text trimmed and single-spaced with its case
 * kept. `null` for empty text.
 */
export function canonicalTag(deck: SododeckFile, typed: string): string | null {
  const text = typed.trim().replace(/\s+/g, ' ');
  if (text === '') return null;
  return tagSpellings(deck).get(tagKey(text)) ?? text;
}

/** The colour stored for a tag (matched by key), or `undefined` when it has none. */
export function tagColourOf(deck: SododeckFile, tag: string): ColorRef | undefined {
  return colourEntries(deck).get(tagKey(tag))?.color;
}
