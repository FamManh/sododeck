/**
 * Removal preview (003 research R5): what deleting some objects would remove, re-point and leave
 * broken, without touching the deck. Runs the real cascade on a throwaway copy, so there is no
 * second copy of the cascade rules and a confirmation's counts cannot drift from the delete.
 */
import type { Id, SododeckFile } from '@sododeck/schema';

import { fromJSON, getObject } from './deck';
import { createEditor, type DeckEditor } from './editor';
import type { IntegrityProblem } from './integrity';
import type { DeckDoc, ObjectRef } from './layout';
import type { RemovalResult } from './ops/cascade';

/** Something a delete removes: a collection object, or a branch of a flow (006). */
export type RemovalTarget =
  | {
      scope: 'nodes' | 'edges' | 'groups' | 'stickies' | 'flows' | 'views' | 'features';
      id: Id;
    }
  | { scope: 'branches'; flowId: Id; id: Id };

/** Removes one target with `editor`, or returns undefined when it does not exist. */
export function removeTarget(
  editor: DeckEditor,
  doc: DeckDoc,
  target: RemovalTarget,
): RemovalResult | undefined {
  if (target.scope === 'branches') {
    const flow = getObject(doc, 'flows', target.flowId);
    if (flow?.branches?.some((b) => b.id === target.id) !== true) return undefined;
    return editor.removeBranch(target.flowId, target.id);
  }
  return getObject(doc, target.scope, target.id) === undefined
    ? undefined
    : editor.remove(target.scope, target.id);
}

const refKey = (ref: ObjectRef) =>
  [ref.scope, ref.id, ref.child?.kind ?? '', ref.child?.id ?? ''].join('\u0000');

const problemKey = (p: IntegrityProblem) => [refKey(p.object), p.field, p.target].join('\u0001');

function unique<T>(items: Iterable<T>, key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

/** Merges several removal results, listing each object and problem once, first seen first. */
export function mergeRemovals(results: readonly RemovalResult[]): RemovalResult {
  return {
    removed: unique(
      results.flatMap((r) => r.removed),
      refKey,
    ),
    updated: unique(
      results.flatMap((r) => r.updated),
      refKey,
    ),
    broken: unique(
      results.flatMap((r) => r.broken),
      problemKey,
    ),
  };
}

/**
 * Pure. What `remove` would do for all targets together (one batch, in order), without writing.
 * A target that does not exist, or that an earlier target's cascade already removed, is skipped.
 */
export function previewRemoval(file: SododeckFile, targets: RemovalTarget[]): RemovalResult {
  const doc = fromJSON(file);
  const editor = createEditor(doc);
  try {
    const results = editor.batch(() => targets.flatMap((t) => removeTarget(editor, doc, t) ?? []));
    return mergeRemovals(results);
  } finally {
    editor.destroy();
    doc.destroy();
  }
}
