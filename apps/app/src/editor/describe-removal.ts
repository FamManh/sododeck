/** Confirmation and toast wording for a delete (FR-017/018). Pure. */
import type { RemovalResult, RemovalTarget } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { selectionTargets, type Selection } from '../state/ui-store';

const plural = (n: number, one: string, many = `${one}s`) => `${String(n)} ${n === 1 ? one : many}`;

function listPhrase(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`;
}

/** Name of a feature, flow or branch target, quoted: 'Delivery'. */
function knowledgeName(deck: SododeckFile, target: RemovalTarget): string | undefined {
  switch (target.scope) {
    case 'features':
      return deck.features.find((f) => f.id === target.id)?.title;
    case 'flows':
      return deck.flows.find((f) => f.id === target.id)?.title;
    case 'branches': {
      const flow = deck.flows.find((f) => f.id === target.flowId);
      const label = flow?.branches?.find((b) => b.id === target.id)?.label;
      return label === undefined ? undefined : label === '' ? 'branch' : `branch ${label}`;
    }
    default:
      return undefined;
  }
}

/** What the user asked to delete, e.g. "Order Service", "3 components", "4 items". */
function subject(deck: SododeckFile, targets: readonly RemovalTarget[]): string {
  const title = (id: string) => deck.nodes.find((n) => n.id === id)?.title ?? id;
  const [only] = targets;
  if (targets.length === 1 && only) {
    const name = knowledgeName(deck, only);
    if (name !== undefined) return `‘${name}’`;
    if (only.scope === 'nodes') return title(only.id);
    const edge = deck.edges.find((e) => e.id === only.id);
    if (only.scope === 'edges' && edge) return `${title(edge.from)} → ${title(edge.to)}`;
  }
  if (targets.every((t) => t.scope === 'nodes')) return plural(targets.length, 'component');
  if (targets.every((t) => t.scope === 'edges')) return plural(targets.length, 'connection');
  return plural(targets.length, 'item');
}

/** Connections removed with their components (not asked for directly). */
function cascadedEdges(targets: readonly RemovalTarget[], result: RemovalResult): number {
  const asked = new Set(targets.filter((t) => t.scope === 'edges').map((t) => t.id));
  return result.removed.filter((r) => r.scope === 'edges' && !asked.has(r.id)).length;
}

function brokenCounts(result: RemovalResult): { steps: number; notes: number } {
  const steps = new Set<string>();
  const notes = new Set<string>();
  for (const { object } of result.broken) {
    if (object.child?.kind === 'step') steps.add(`${object.id}/${object.child.id}`);
    else if (object.scope === 'stickies') notes.add(object.id);
  }
  return { steps: steps.size, notes: notes.size };
}

export function describeRemoval(
  deck: SododeckFile,
  targets: readonly RemovalTarget[],
  result: RemovalResult,
): { title: string; body: string } {
  const edges = cascadedEdges(targets, result);
  const { steps, notes } = brokenCounts(result);
  const sentences: string[] = [];
  const flowsMoved = result.updated.filter(
    (r) => r.scope === 'flows' && targets.some((t) => t.scope === 'features'),
  ).length;
  if (flowsMoved > 0) {
    sentences.push(`Its ${plural(flowsMoved, 'flow')} will move to No feature.`);
  }
  const stepsRemoved = result.removed.filter((r) => r.child?.kind === 'step').length;
  if (stepsRemoved > 0) sentences.push(`Its ${plural(stepsRemoved, 'step')} will be deleted.`);
  if (edges > 0) sentences.push(`Also removes ${plural(edges, 'connection')}.`);
  const broken = [
    ...(steps > 0 ? [plural(steps, 'flow step')] : []),
    ...(notes > 0 ? [plural(notes, 'note')] : []),
  ];
  if (broken.length > 0) {
    sentences.push(`${listPhrase(broken)} will be flagged broken.`);
  }
  sentences.push('You can undo this.');
  return { title: `Delete ${subject(deck, targets)}?`, body: sentences.join(' ') };
}

/** Toast text after the delete, with the undo shortcut for this platform. */
export function removalToast(
  deck: SododeckFile,
  targets: readonly RemovalTarget[],
  result: RemovalResult,
  apple: boolean,
): string {
  const edges = cascadedEdges(targets, result);
  const what =
    edges > 0
      ? `${subject(deck, targets)} and ${plural(edges, 'connection')}`
      : subject(deck, targets);
  return `Deleted ${what} · ${apple ? '⌘Z' : 'Ctrl+Z'} to undo`;
}

/** Components first, then connections: the order the confirmation and the delete both use. */
export function removalTargets(selection: Selection): RemovalTarget[] {
  return selectionTargets(selection);
}
