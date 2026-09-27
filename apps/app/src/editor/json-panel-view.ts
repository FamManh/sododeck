/**
 * Pure view models of the JSON panel (004 data-model.md). All text comes from `@sododeck/model`;
 * the app never serializes deck data itself (constitution II).
 */
import { serializeEntries, serializeEntry, type Entry } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { JsonTab } from '../state/json-panel-prefs';
import type { Selection } from '../state/ui-store';

export interface SelectionView {
  /** Visible tab label (truncated with CSS). */
  label: string;
  /** Accessible name and tooltip. */
  fullLabel: string;
  /** Selected nodes, then selected edges, each in deck order. */
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

/** What the Selection tab shows and how it is labelled (research R9, clarification Q1). */
export function selectionView(deck: SododeckFile, selection: Selection): SelectionView {
  const nodeIds = new Set(selection.nodes);
  const edgeIds = new Set(selection.edges);
  const nodes = deck.nodes.filter((node) => nodeIds.has(node.id));
  const edges = deck.edges.filter((edge) => edgeIds.has(edge.id));
  const entries: Entry[] = [
    ...nodes.map((value) => ({ collection: 'nodes' as const, value })),
    ...edges.map((value) => ({ collection: 'edges' as const, value })),
  ];

  let label = 'Selection';
  const [node] = nodes;
  const [edge] = edges;
  if (entries.length > 1) label = `${String(entries.length)} selected`;
  else if (node) label = node.title;
  else if (edge) {
    const title = (id: string) => deck.nodes.find((n) => n.id === id)?.title ?? id;
    label = edge.label ?? `${title(edge.from)} → ${title(edge.to)}`;
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
