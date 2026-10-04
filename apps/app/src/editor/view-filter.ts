/**
 * What a saved view shows (011 research R7, FR-012–FR-014): pure, linear in the deck, and the
 * same for every view type (FR-002a). Presets differ only in the settings they carry.
 */
import { isDbTable, tagKey } from '@sododeck/model';
import type { Id, SododeckFile, View } from '@sododeck/schema';

export interface ViewFilterResult {
  /** Components the view does not draw (their connections are not drawn either). */
  hidden: ReadonlySet<Id>;
  /** Components drawn at reduced opacity (FR-013); never hidden ones. */
  dimmed: ReadonlySet<Id>;
}

const EMPTY: ReadonlySet<Id> = new Set();

function sameSet(a: ReadonlySet<Id>, b: ReadonlySet<Id>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/** Group ids a node sits in, innermost first (cycle-safe). */
function lineageOf(
  groupId: Id | undefined,
  parents: ReadonlyMap<Id, Id | undefined>,
  out: Set<Id>,
): void {
  let current = groupId;
  while (current !== undefined && parents.has(current) && !out.has(current)) {
    out.add(current);
    current = parents.get(current);
  }
}

/**
 * Nodes at either end of an edge used by a step of a flow of `featureId`. An end may be a group
 * (050 R6); a frame is drawn only around shown cards, so a group end keeps every card inside it.
 */
function featureNodes(deck: SododeckFile, featureId: Id): ReadonlySet<Id> {
  const edges = new Map(deck.edges.map((edge) => [edge.id, edge]));
  const ends = new Set<Id>();
  for (const flow of deck.flows) {
    if (flow.feature !== featureId) continue;
    for (const step of flow.steps) {
      const edge = edges.get(step.edge);
      if (edge === undefined) continue;
      ends.add(edge.from);
      ends.add(edge.to);
    }
  }
  if (!deck.groups.some((group) => ends.has(group.id))) return ends;
  const parents = new Map(deck.groups.map((g) => [g.id, g.parent]));
  const out = new Set(ends);
  const lineage = new Set<Id>();
  for (const node of deck.nodes) {
    lineage.clear();
    lineageOf(node.group, parents, lineage);
    for (const groupId of lineage) {
      if (ends.has(groupId)) {
        out.add(node.id);
        break;
      }
    }
  }
  return out;
}

/** Last result per view object, so an unchanged result keeps its identity (memo keys). */
const lastResult = new WeakMap<View, ViewFilterResult>();

/**
 * Hidden and dimmed components of `view`. `revealed` components (created here while the view
 * hides them) are never hidden. A feature that no longer exists means "All features".
 */
export function viewFilter(
  deck: SododeckFile,
  view: View,
  revealed: ReadonlySet<Id>,
): ViewFilterResult {
  const includes = view.includes === undefined ? null : new Set(view.includes);
  // Schemas (048): a table shows when its schema is listed or its id is in `includes`.
  const schemas = view.schemas === undefined ? null : new Set(view.schemas);
  const excludeGroups = new Set(view.excludeGroups ?? []);
  const excludeKinds = new Set<string>(view.excludeKinds ?? []);
  // Tags match by key (033): hiding "pci" hides a card tagged "PCI".
  const excludeTags = new Set((view.excludeTags ?? []).map(tagKey));
  const dimKinds = new Set<string>(view.dimKinds ?? []);
  const feature =
    view.feature !== undefined && deck.features.some((f) => f.id === view.feature)
      ? featureNodes(deck, view.feature)
      : null;
  const parents =
    excludeGroups.size === 0 ? null : new Map(deck.groups.map((g) => [g.id, g.parent]));

  const hidden = new Set<Id>();
  const dimmed = new Set<Id>();
  const lineage = new Set<Id>();
  for (const node of deck.nodes) {
    const notIncluded =
      schemas !== null && isDbTable(node)
        ? !(includes?.has(node.id) === true || schemas.has(node.schema ?? ''))
        : includes !== null && !includes.has(node.id);
    let hide =
      notIncluded ||
      excludeKinds.has(node.type) ||
      (feature !== null && !feature.has(node.id)) ||
      (node.tags ?? []).some((tag) => excludeTags.has(tagKey(tag)));
    if (!hide && parents !== null) {
      lineage.clear();
      lineageOf(node.group, parents, lineage);
      for (const groupId of lineage) {
        if (excludeGroups.has(groupId)) {
          hide = true;
          break;
        }
      }
    }
    if (hide && !revealed.has(node.id)) hidden.add(node.id);
  }
  // Children live inside their parent component: a hidden parent hides them too (010 drill-in).
  if (hidden.size > 0) {
    const parentOf = new Map(deck.nodes.map((node) => [node.id, node.parent]));
    for (const node of deck.nodes) {
      if (hidden.has(node.id) || revealed.has(node.id)) continue;
      const seen = new Set<Id>([node.id]);
      let parent = node.parent;
      while (parent !== undefined && !seen.has(parent) && parentOf.has(parent)) {
        if (hidden.has(parent)) {
          hidden.add(node.id);
          break;
        }
        seen.add(parent);
        parent = parentOf.get(parent);
      }
    }
  }
  for (const node of deck.nodes) {
    if (!hidden.has(node.id) && dimKinds.has(node.type)) dimmed.add(node.id);
  }

  const previous = lastResult.get(view);
  const result: ViewFilterResult = {
    hidden:
      hidden.size === 0
        ? EMPTY
        : previous !== undefined && sameSet(previous.hidden, hidden)
          ? previous.hidden
          : hidden,
    dimmed:
      dimmed.size === 0
        ? EMPTY
        : previous !== undefined && sameSet(previous.dimmed, dimmed)
          ? previous.dimmed
          : dimmed,
  };
  if (previous?.hidden === result.hidden && previous.dimmed === result.dimmed) return previous;
  lastResult.set(view, result);
  return result;
}

const flowCountCache = new WeakMap<
  SododeckFile['flows'],
  WeakMap<SododeckFile['edges'], ReadonlyMap<Id, number>>
>();

/** Per component: the number of flows with at least one step whose edge touches it (FR-011). */
export function flowCountByNode(deck: SododeckFile): ReadonlyMap<Id, number> {
  let byEdges = flowCountCache.get(deck.flows);
  if (byEdges === undefined) {
    byEdges = new WeakMap();
    flowCountCache.set(deck.flows, byEdges);
  }
  const cached = byEdges.get(deck.edges);
  if (cached !== undefined) return cached;
  const edges = new Map(deck.edges.map((edge) => [edge.id, edge]));
  const counts = new Map<Id, number>();
  const touched = new Set<Id>();
  for (const flow of deck.flows) {
    touched.clear();
    for (const step of flow.steps) {
      const edge = edges.get(step.edge);
      if (edge === undefined) continue;
      touched.add(edge.from);
      touched.add(edge.to);
    }
    for (const id of touched) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  byEdges.set(deck.edges, counts);
  return counts;
}

/** The first view (in order) whose filters show `nodeId`, or null when none does (FR-016). */
export function firstViewShowing(
  deck: SododeckFile,
  views: readonly View[],
  nodeId: Id,
): View | null {
  return views.find((view) => !viewFilter(deck, view, EMPTY).hidden.has(nodeId)) ?? null;
}
