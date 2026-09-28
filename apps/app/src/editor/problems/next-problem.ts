import type { Problem } from '@sododeck/model';

/**
 * The problem ⌘. (1) or ⇧⌘. (-1) goes to (015 FR-021): the one after (or before) the last visited,
 * wrapping at the ends. When the last visited problem is gone (fixed), the walk restarts from the
 * first (or last) problem. `null` when there are none.
 */
export function nextProblem(
  list: readonly Problem[],
  cursor: string | null,
  direction: 1 | -1,
): Problem | null {
  if (list.length === 0) return null;
  const index = cursor === null ? -1 : list.findIndex((p) => p.key === cursor);
  if (index === -1) return (direction === 1 ? list[0] : list.at(-1)) ?? null;
  return list[(index + direction + list.length) % list.length] ?? null;
}
