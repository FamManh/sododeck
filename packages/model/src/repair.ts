/**
 * The one repair after a change from elsewhere (036 research R9). Two valid concurrent edits can
 * leave a view naming a component or group that no longer exists (A deletes a node while B pins
 * it). Those entries are noise nobody should clean by hand, and a `groupFrames` key naming no
 * group makes the file invalid (rule S5), so they are removed. Everything else a person wrote is
 * kept and reported as a problem. Pure Yjs writes, no transaction of its own: the editor runs it
 * with its untracked origin, so it is saved and synced but never an undo step.
 */
import * as Y from 'yjs';

import type { YObject } from './convert';
import { collectionMap, type DeckDoc } from './layout';
import { isSchemaGroupId } from './schema-groups';

type Exists = (id: string) => boolean;

/** Removes ids that name nothing from a list field; drops the field when emptied and `dropEmpty`. */
function listFix(view: YObject, field: string, exists: Exists, dropEmpty: boolean): (() => void)[] {
  const list = view.get(field);
  if (!(list instanceof Y.Array)) return [];
  const dangling = list.toArray().some((id) => typeof id === 'string' && !exists(id));
  if (!dangling) return [];
  return [
    () => {
      for (let i = list.length - 1; i >= 0; i--) {
        const id: unknown = list.get(i);
        if (typeof id === 'string' && !exists(id)) list.delete(i, 1);
      }
      if (dropEmpty && list.length === 0) view.delete(field);
    },
  ];
}

/** Removes keys that name nothing from a map field; drops the field when emptied and `dropEmpty`. */
function mapFix(view: YObject, field: string, exists: Exists, dropEmpty: boolean): (() => void)[] {
  const map = view.get(field);
  if (!(map instanceof Y.Map)) return [];
  const dangling = [...map.keys()].filter((id) => !exists(id));
  if (dangling.length === 0) return [];
  return [
    () => {
      for (const id of dangling) map.delete(id);
      if (dropEmpty && map.size === 0) view.delete(field);
    },
  ];
}

/**
 * The writes that would remove view entries naming nothing, in every stored view; empty for a
 * clean deck. Lists and maps are dropped when emptied exactly where the local delete cascade
 * drops them (ops/cascade.ts), so a repaired view reads as a local delete would have left it.
 */
function viewFixes(doc: DeckDoc): (() => void)[] {
  const nodes = collectionMap(doc, 'nodes');
  const groups = collectionMap(doc, 'groups');
  const node: Exists = (id) => nodes.has(id);
  const group: Exists = (id) => groups.has(id);
  return [...collectionMap(doc, 'views').values()].flatMap((view) => [
    ...listFix(view, 'includes', node, false),
    ...listFix(view, 'pinned', node, true),
    ...mapFix(view, 'positions', node, false),
    ...listFix(view, 'excludeGroups', group, true),
    // A derived schema group (048) has no stored object, so it is never dangling.
    ...listFix(view, 'collapsed', (id) => isSchemaGroupId(id) || group(id), true),
    ...mapFix(view, 'groupFrames', group, true),
  ]);
}

/** Whether some stored view names a component or group that does not exist. */
export function hasDanglingViewRefs(doc: DeckDoc): boolean {
  return viewFixes(doc).length > 0;
}

/**
 * Removes view entries that name a component or group that does not exist. Writes nothing on a
 * clean deck. Returns whether it changed anything. Call inside a transaction.
 */
export function repairViewRefs(doc: DeckDoc): boolean {
  const fixes = viewFixes(doc);
  for (const fix of fixes) fix();
  return fixes.length > 0;
}
