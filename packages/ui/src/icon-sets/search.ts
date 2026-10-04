import { ICON_SETS } from './sets';
import { resolvedIconsOf } from './resolve';
import type { IconSet, ResolvedIcon } from './types';

/** Lower is better; `null` = no match. */
function rank(
  query: string,
  name: string,
  label: string,
  keywords: readonly string[],
): number | null {
  const lowerLabel = label.toLowerCase();
  if (name === query || lowerLabel === query) return 0;
  if (name.startsWith(query) || lowerLabel.startsWith(query)) return 1;
  if (keywords.some((k) => k.startsWith(query))) return 2;
  if (
    name.includes(query) ||
    lowerLabel.includes(query) ||
    keywords.some((k) => k.includes(query))
  ) {
    return 3;
  }
  return null;
}

/**
 * Icons matching a query: exact name or label, then prefix, then keyword prefix, then substring.
 * Ties keep catalog order. An empty query matches nothing (the picker shows its sections).
 */
export function searchIcons(
  query: string,
  sets: readonly IconSet[] = ICON_SETS,
  setId?: string,
): ResolvedIcon[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];

  const hits: { icon: ResolvedIcon; rank: number; order: number }[] = [];
  let order = 0;
  for (const set of sets) {
    if (setId !== undefined && set.id !== setId) continue;
    const resolved = resolvedIconsOf(set);
    for (const entry of set.icons) {
      const r = rank(q, entry.name, entry.label, entry.keywords);
      const icon = r === null ? undefined : resolved.get(entry.name);
      if (r !== null && icon) hits.push({ icon, rank: r, order });
      order += 1;
    }
  }
  return hits.sort((a, b) => a.rank - b.rank || a.order - b.order).map((h) => h.icon);
}
