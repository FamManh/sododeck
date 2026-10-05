/**
 * Pure view models of the JSON panel (004 data-model.md). All text comes from `@sododeck/model`;
 * the app never serializes deck data itself (constitution II).
 */
import {
  analyzeFlow,
  endpointTitle,
  type Entry,
  serializeEntries,
  serializeEntry,
  stickyLabel,
} from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { JsonTab } from '../state/json-panel-prefs';
import type { ActiveFlow, Selection } from '../state/ui-store';
import { currentOf, playedPath } from './flows/played-path';

export interface SelectionView {
  /** Visible tab label (truncated with CSS). */
  label: string;
  /** Accessible name and tooltip. */
  fullLabel: string;
  /** Selected nodes, edges, groups, notes, then images, each in deck order. */
  entries: Entry[];
}

/** Lines of a text; a trailing newline does not start a new line. */
export function countLines(text: string): number {
  if (text === '') return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

export function lineCountLabel(count: number): string {
  return count === 1 ? '1 line' : `${String(count)} lines`;
}

/**
 * What the Selection tab shows and how it is labelled (research R9, clarification Q1). A shown flow
 * (006) shows its whole entry, labelled "Flow", or "Step" while a step or branch is selected. In
 * flow mode (007 FR-022) it shows the current step's own entry, labelled "Step <number>".
 */
export function selectionView(
  deck: SododeckFile,
  selection: Selection,
  activeFlow: ActiveFlow = null,
  flowMode = false,
): SelectionView {
  const flow = activeFlow === null ? undefined : deck.flows.find((f) => f.id === activeFlow.flowId);
  if (flow !== undefined && flowMode && activeFlow?.branchId == null) {
    const analysis = analyzeFlow(flow, deck.edges);
    const current = currentOf(
      playedPath(analysis, activeFlow?.alternativeId ?? null),
      activeFlow?.stepId ?? null,
    );
    if (current !== null) {
      const label = `Step ${current.number}`;
      return {
        label,
        fullLabel: `${label}: ${flow.title}`,
        entries: [{ collection: 'steps', value: current.step }],
      };
    }
  }
  if (flow !== undefined) {
    const label = activeFlow?.stepId != null || activeFlow?.branchId != null ? 'Step' : 'Flow';
    return {
      label,
      fullLabel: `${label}: ${flow.title}`,
      entries: [{ collection: 'flows', value: flow }],
    };
  }
  const nodeIds = new Set(selection.nodes);
  const edgeIds = new Set(selection.edges);
  const groupIds = new Set(selection.groups);
  const stickyIds = new Set(selection.stickies);
  const imageIds = new Set(selection.images);
  const nodes = deck.nodes.filter((node) => nodeIds.has(node.id));
  const edges = deck.edges.filter((edge) => edgeIds.has(edge.id));
  const groups = deck.groups.filter((group) => groupIds.has(group.id));
  const stickies = deck.stickies.filter((sticky) => stickyIds.has(sticky.id));
  const images = (deck.images ?? []).filter((image) => imageIds.has(image.id));
  const entries: Entry[] = [
    ...nodes.map((value) => ({ collection: 'nodes' as const, value })),
    ...edges.map((value) => ({ collection: 'edges' as const, value })),
    ...groups.map((value) => ({ collection: 'groups' as const, value })),
    ...stickies.map((value) => ({ collection: 'stickies' as const, value })),
    ...images.map((value) => ({ collection: 'images' as const, value })),
  ];

  let label = 'Selection';
  const [node] = nodes;
  const [edge] = edges;
  const [group] = groups;
  const [sticky] = stickies;
  const [image] = images;
  if (entries.length > 1) label = `${String(entries.length)} selected`;
  else if (node) label = node.title;
  else if (edge) {
    // Either end may be a group (050 R6).
    label = edge.label ?? `${endpointTitle(deck, edge.from)} → ${endpointTitle(deck, edge.to)}`;
  } else if (group) label = group.title;
  else if (sticky) label = stickyLabel(sticky.text) ?? 'Empty note';
  else if (image) {
    label =
      image.alt !== undefined && image.alt !== ''
        ? image.alt
        : (deck.assets?.[image.asset]?.name ?? 'Image');
  }
  return { label, fullLabel: label, entries };
}

/** `''` for no entries, one object for one, a JSON array for several. */
export function selectionText(entries: readonly Entry[]): string {
  const [first] = entries;
  if (!first) return '';
  return entries.length === 1
    ? serializeEntry(first.collection, first.value)
    : serializeEntries(entries);
}

export function copyToastText(tab: JsonTab, view: SelectionView): string {
  if (tab === 'deck') return 'Copied Deck JSON';
  if (view.entries.length > 1) return `Copied ${String(view.entries.length)} items as JSON`;
  return `Copied ${view.fullLabel} JSON`;
}
