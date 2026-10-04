/**
 * Virtual schema groups (048, research R5): in By schema mode the tables of one schema form a
 * derived group `schema:<name>`. Stored group ids never start with `schema:`, so a collapse list
 * can hold both kinds of id and a derived group cannot collide with a stored one.
 */
import type { Group, Issue } from '@sododeck/schema';

const PREFIX = 'schema:';

/** The id of the derived group of schema `name`. */
export function schemaGroupId(name: string): string {
  return `${PREFIX}${name}`;
}

/** True for an id in the derived schema-group namespace. */
export function isSchemaGroupId(id: string): boolean {
  return id.startsWith(PREFIX);
}

/**
 * Splits the stored groups of a deck into the ones the app uses and the ones it skips because
 * their id is in the reserved `schema:` namespace (a hand-written or imported file; the editor
 * never generates one). `skipped` is one issue per skipped group. Returns `groups` itself when
 * nothing is skipped.
 */
export function splitStoredGroups<T extends Pick<Group, 'id'>>(
  groups: readonly T[],
): { groups: readonly T[]; skipped: Issue[] } {
  if (!groups.some((group) => isSchemaGroupId(group.id))) return { groups, skipped: [] };
  const skipped: Issue[] = [];
  const kept: T[] = [];
  groups.forEach((group, i) => {
    if (!isSchemaGroupId(group.id)) {
      kept.push(group);
      return;
    }
    skipped.push({
      path: `groups.${String(i)}.id`,
      message: `Group id "${group.id}" is reserved for schema groups and is not used.`,
    });
  });
  return { groups: kept, skipped };
}
