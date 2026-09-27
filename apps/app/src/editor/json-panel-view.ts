/**
 * Pure view models of the JSON panel (004 data-model.md). All text comes from `@sododeck/model`;
 * the app never serializes deck data itself (constitution II).
 */
import {
  analyzeFlow,
  serializeEntries,
  serializeEntry,
  stickyLabel,
  type Entry,
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
  /** Selected nodes, then selected edges, then selected notes, each in deck order. */
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
  const stickyIds = new Set(selection.stickies);
  const nodes = deck.nodes.filter((node) => nodeIds.has(node.id));
  const edges = deck.edges.filter((edge) => edgeIds.has(edge.id));
  const stickies = deck.stickies.filter((sticky) => stickyIds.has(sticky.id));
  const entries: Entry[] = [
    ...nodes.map((value) => ({ collection: 'nodes' as const, value })),
    ...edges.map((value) => ({ collection: 'edges' as const, value })),
    ...stickies.map((value) => ({ collection: 'stickies' as const, value })),
  ];

  let label = 'Selection';
  const [node] = nodes;
  const [edge] = edges;
  const [sticky] = stickies;
  if (entries.length > 1) label = `${String(entries.length)} selected`;
  else if (node) label = node.title;
  else if (edge) {
    const title = (id: string) => deck.nodes.find((n) => n.id === id)?.title ?? id;
    label = edge.label ?? `${title(edge.from)} → ${title(edge.to)}`;
  } else if (sticky) label = stickyLabel(sticky.text) ?? 'Empty note';
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
