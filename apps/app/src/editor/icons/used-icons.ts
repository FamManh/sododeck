/**
 * The "Used in this deck" icons (038 T044): `iconUsage` rows resolved to icons. Two spellings of
 * one icon (`server`, `lucide:server`) merge into one cell, references this version cannot show
 * are left out, and the order is most used first, ties by first appearance.
 */
import { resolveIcon, type IconSet, type ResolvedIcon } from '@sododeck/ui/icon-sets';

export function usedIcons(
  usage: readonly { ref: string; count: number }[],
  sets?: readonly IconSet[],
): ResolvedIcon[] {
  const merged = new Map<ResolvedIcon, number>();
  for (const { ref, count } of usage) {
    const icon = resolveIcon(ref, sets);
    if (icon !== null) merged.set(icon, (merged.get(icon) ?? 0) + count);
  }
  // `Array.sort` is stable, so equal counts keep their insertion (first-seen) order.
  return [...merged].sort((a, b) => b[1] - a[1]).map(([icon]) => icon);
}
