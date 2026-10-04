/**
 * By schema grouping (048, ADR 0034): the deck as the canvas draws it when the deck's grouping
 * mode is `schema`. Every table with a schema moves into the derived group `schema:<name>`;
 * nothing is stored, so By group is one switch away and the JSON never sees these groups.
 * Frames are not stored either: `groupBounds` derives them from the members.
 */
import { isDbTable, isSchemaGroupId, schemaGroupId } from '@sododeck/model';
import type { Group, Node, SododeckFile } from '@sododeck/schema';

type Deck = SododeckFile;

type Lists = Pick<Deck, 'nodes' | 'groups'>;

/** Derived lists per source lists, so an edit to edges or fields keeps the node objects. */
const listCache = new WeakMap<Deck['nodes'], WeakMap<Deck['groups'], Lists | null>>();
const deckCache = new WeakMap<Deck, Deck>();

function build(deck: Deck): Lists | null {
  const titles = new Map<string, Group>();
  const nodes = deck.nodes.map((node): Node => {
    if (!isDbTable(node) || node.schema === undefined || node.schema === '') return node;
    const id = schemaGroupId(node.schema);
    if (!titles.has(id)) titles.set(id, { id, title: node.schema });
    return node.group === id ? node : { ...node, group: id };
  });
  if (titles.size === 0) return null;

  // A stored group that only this mode emptied would draw as an empty frame; leave it out.
  const parents = new Map(deck.groups.map((group) => [group.id, group.parent]));
  const filled = (list: readonly Node[]) => {
    const out = new Set<string>();
    for (const node of list) {
      let current = node.group;
      while (current !== undefined && !out.has(current) && parents.has(current)) {
        out.add(current);
        current = parents.get(current);
      }
    }
    return out;
  };
  const before = filled(deck.nodes);
  const after = filled(nodes);
  const real = deck.groups.filter((group) => !before.has(group.id) || after.has(group.id));
  return { nodes, groups: [...real, ...titles.values()] };
}

/** `deck` with its tables grouped by schema; `deck` itself when no table has a schema. */
export function schemaGroupedDeck(deck: Deck): Deck {
  const known = deckCache.get(deck);
  if (known !== undefined) return known;
  let byGroups = listCache.get(deck.nodes);
  if (byGroups === undefined) {
    byGroups = new WeakMap();
    listCache.set(deck.nodes, byGroups);
  }
  let lists = byGroups.get(deck.groups);
  if (lists === undefined) {
    lists = build(deck);
    byGroups.set(deck.groups, lists);
  }
  const out = lists === null ? deck : { ...deck, ...lists };
  deckCache.set(deck, out);
  return out;
}

/**
 * The name of a group in `deck`'s stored groups, or the schema name of a derived `schema:<name>`
 * id (stored decks do not hold the derived groups); undefined for an unknown id.
 */
export function groupTitleOf(deck: Pick<SododeckFile, 'groups'>, id: string): string | undefined {
  const stored = deck.groups.find((group) => group.id === id);
  if (stored !== undefined) return stored.title;
  return isSchemaGroupId(id) ? id.slice(schemaGroupId('').length) : undefined;
}

const collapsedCache = new WeakMap<
  Deck['nodes'],
  WeakMap<ReadonlySet<string>, ReadonlyMap<string, string>>
>();

/**
 * Tables hidden inside a collapsed schema group, as table id → group id. `canvas` is the deck as
 * the canvas draws it (`ViewState.deck`); By group has no derived groups, so the map is empty.
 */
export function collapsedSchemaTables(
  canvas: Pick<Deck, 'nodes'>,
  collapsed: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  let byCollapsed = collapsedCache.get(canvas.nodes);
  if (byCollapsed === undefined) {
    byCollapsed = new WeakMap();
    collapsedCache.set(canvas.nodes, byCollapsed);
  }
  const known = byCollapsed.get(collapsed);
  if (known !== undefined) return known;
  const out = new Map<string, string>();
  for (const node of canvas.nodes) {
    if (node.group !== undefined && isSchemaGroupId(node.group) && collapsed.has(node.group)) {
      out.set(node.id, node.group);
    }
  }
  byCollapsed.set(collapsed, out);
  return out;
}
