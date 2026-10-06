/** Confirmation and toast wording for a delete (FR-017/018). Pure. */
import { endpointTitle, isDbTable, type RemovalResult, type RemovalTarget } from '@sododeck/model';
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
  const title = (id: string) => endpointTitle(deck, id);
  const [only] = targets;
  if (targets.length === 1 && only) {
    const name = knowledgeName(deck, only);
    if (name !== undefined) return `‘${name}’`;
    if (only.scope === 'nodes' || only.scope === 'groups') return title(only.id);
    const edge = deck.edges.find((e) => e.id === only.id);
    if (only.scope === 'edges' && edge) return `${title(edge.from)} → ${title(edge.to)}`;
  }
  if (targets.every((t) => t.scope === 'groups')) return plural(targets.length, 'group');
  if (targets.every((t) => t.scope === 'stickies')) return plural(targets.length, 'note');
  if (targets.every((t) => t.scope === 'images')) return plural(targets.length, 'image');
  if (targets.every((t) => t.scope === 'nodes')) return plural(targets.length, 'component');
  if (targets.every((t) => t.scope === 'edges')) return plural(targets.length, 'connection');
  return plural(targets.length, 'item');
}

/** Connections removed with their components (not asked for directly). */
function cascadedEdges(targets: readonly RemovalTarget[], result: RemovalResult): number {
  const asked = new Set(targets.filter((t) => t.scope === 'edges').map((t) => t.id));
  return result.removed.filter((r) => r.scope === 'edges' && !asked.has(r.id)).length;
}

/** Flow steps a delete leaves broken (a note never points at anything, ADR 0041). */
function brokenSteps(result: RemovalResult): number {
  const steps = new Set<string>();
  for (const { object } of result.broken) {
    if (object.child?.kind === 'step') steps.add(`${object.id}/${object.child.id}`);
  }
  return steps.size;
}

/**
 * Tables a delete keeps but leaves without their database card (049): children of a removed
 * node that stay, reported by the cascade as updated.
 */
export function keptTables(
  deck: SododeckFile,
  targets: readonly RemovalTarget[],
  result: RemovalResult,
): string[] {
  const removed = new Set(targets.filter((t) => t.scope === 'nodes').map((t) => t.id));
  if (removed.size === 0) return [];
  const byId = new Map(deck.nodes.map((node) => [node.id, node]));
  return result.updated.flatMap((ref) => {
    if (ref.scope !== 'nodes' || ref.child !== undefined || removed.has(ref.id)) return [];
    const node = byId.get(ref.id);
    return node !== undefined &&
      isDbTable(node) &&
      node.parent !== undefined &&
      removed.has(node.parent)
      ? [ref.id]
      : [];
  });
}

function keptTablesSentence(count: number): string | null {
  if (count === 0) return null;
  return count === 1
    ? '1 table is kept and becomes unowned.'
    : `${String(count)} tables are kept and become unowned.`;
}

/** The single rule a removal is for, if it is one (008). */
function ruleTarget(deck: SododeckFile, targets: readonly RemovalTarget[]) {
  const [only] = targets;
  if (targets.length !== 1 || only?.scope !== 'rules') return undefined;
  return { id: only.id, title: deck.rules[only.id]?.title ?? only.id };
}

/** "Used in 2 steps and 1 component. It will be detached from them." (008 FR-024). */
function ruleUsageSentence(result: RemovalResult): string {
  const steps = result.updated.filter((r) => r.child?.kind === 'step').length;
  const nodes = result.updated.filter((r) => r.scope === 'nodes').length;
  if (steps === 0 && nodes === 0) return 'It isn’t used anywhere.';
  const parts = [
    ...(steps > 0 ? [plural(steps, 'step')] : []),
    ...(nodes > 0 ? [plural(nodes, 'component')] : []),
  ];
  return `Used in ${listPhrase(parts)}. It will be detached from them.`;
}

export function describeRemoval(
  deck: SododeckFile,
  targets: readonly RemovalTarget[],
  result: RemovalResult,
): { title: string; body: string } {
  const rule = ruleTarget(deck, targets);
  if (rule !== undefined) {
    return {
      title: `Delete rule “${rule.title}”?`,
      body: ruleUsageSentence(result),
    };
  }
  const edges = cascadedEdges(targets, result);
  const steps = brokenSteps(result);
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
  const kept = keptTablesSentence(keptTables(deck, targets, result).length);
  if (kept !== null) sentences.push(kept);
  if (steps > 0) sentences.push(`${plural(steps, 'flow step')} will be flagged broken.`);
  sentences.push('You can undo this.');
  const stickyOnly = targets.length > 0 && targets.every((t) => t.scope === 'stickies');
  const imageOnly = targets.length > 0 && targets.every((t) => t.scope === 'images');
  const title =
    stickyOnly && targets.length === 1
      ? 'Delete this note?'
      : stickyOnly
        ? `Delete ${String(targets.length)} notes?`
        : imageOnly && targets.length === 1
          ? 'Delete this image?'
          : `Delete ${subject(deck, targets)}?`;
  return { title, body: sentences.join(' ') };
}

/** Toast text after the delete, with the undo shortcut for this platform. */
export function removalToast(
  deck: SododeckFile,
  targets: readonly RemovalTarget[],
  result: RemovalResult,
  apple: boolean,
): string {
  const rule = ruleTarget(deck, targets);
  if (rule !== undefined)
    return `Rule “${rule.title}” deleted · ${apple ? '⌘Z' : 'Ctrl+Z'} to undo`;
  if (targets.length > 0 && targets.every((t) => t.scope === 'stickies')) {
    return `${targets.length === 1 ? 'Note deleted' : `${String(targets.length)} notes deleted`} · ${apple ? '⌘Z' : 'Ctrl+Z'} to undo`;
  }
  if (targets.length > 0 && targets.every((t) => t.scope === 'groups')) {
    // Deleting a group ungroups it (its cards stay), so say that instead of "Deleted".
    const connectors = cascadedEdges(targets, result);
    const also = connectors > 0 ? ` · also deleted ${plural(connectors, 'connection')}` : '';
    return `Ungrouped ${subject(deck, targets)}${also} · ${apple ? '⌘Z' : 'Ctrl+Z'} to undo`;
  }
  if (targets.length > 0 && targets.every((t) => t.scope === 'images')) {
    const connectors = cascadedEdges(targets, result);
    const label =
      targets.length === 1 ? 'Image deleted' : `${String(targets.length)} images deleted`;
    const also = connectors > 0 ? ` and ${plural(connectors, 'connection')}` : '';
    return `${label}${also} · ${apple ? '⌘Z' : 'Ctrl+Z'} to undo`;
  }
  const edges = cascadedEdges(targets, result);
  const what =
    edges > 0
      ? `${subject(deck, targets)} and ${plural(edges, 'connection')}`
      : subject(deck, targets);
  const keptCount = keptTables(deck, targets, result).length;
  const kept = keptCount > 0 ? ` · ${plural(keptCount, 'table')} kept` : '';
  return `Deleted ${what}${kept} · ${apple ? '⌘Z' : 'Ctrl+Z'} to undo`;
}

/**
 * Adds "n new problems" before the undo hint when a delete created problems (015 FR-026), so the
 * toast and the announcement say what broke.
 */
export function withNewProblems(message: string, before: number, after: number): string {
  const added = after - before;
  if (added <= 0) return message;
  const note = ` · ${plural(added, 'new problem')}`;
  const hint = message.lastIndexOf(' · ');
  return hint === -1
    ? `${message}${note}`
    : `${message.slice(0, hint)}${note}${message.slice(hint)}`;
}

/** Every selected kind, in delete order (`state/selection-kinds.ts`). */
export function removalTargets(selection: Selection): RemovalTarget[] {
  return selectionTargets(selection);
}
