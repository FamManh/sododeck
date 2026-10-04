import { resolveTypeId, TYPE_FALLBACK, TYPE_STYLE } from '@sododeck/ui/lib/icons';

import { CHROME_ICONS, type ChromeIconKey } from './chrome-icons';
import { ICON_SETS } from './sets';
import { LUCIDE_GEOMETRY } from './lucide.generated';
import type { IconSet, NodeIconResult, ResolvedIcon } from './types';

const REF = /^(?:([a-z0-9-]+):)?([a-z0-9-]+)$/;

/**
 * Reads a stored icon reference: `set:name`, or `name` alone for lucide. Matching is
 * case-insensitive. Anything else is unreadable (`null`); the caller keeps the stored text.
 */
export function parseIconRef(value: string): { set: string; name: string } | null {
  const match = REF.exec(value.toLowerCase());
  if (!match) return null;
  const [, set, name] = match;
  if (name === undefined) return null;
  return { set: set ?? 'lucide', name };
}

interface SetIndex {
  byName: Map<string, ResolvedIcon>;
  aliases: Readonly<Record<string, string>>;
}

// One ResolvedIcon per icon and one lookup per stored string, so a canvas of 500 cards costs 500
// map hits and React sees stable objects.
const setIndexes = new WeakMap<IconSet, SetIndex>();
const refCaches = new WeakMap<readonly IconSet[], Map<string, ResolvedIcon | null>>();

function indexOf(set: IconSet): SetIndex {
  let index = setIndexes.get(set);
  if (!index) {
    const byName = new Map<string, ResolvedIcon>();
    for (const icon of set.icons) {
      byName.set(icon.name, {
        set: set.id,
        name: icon.name,
        label: icon.label,
        node: icon.node,
        style: set.style,
      });
    }
    index = { byName, aliases: set.aliases };
    setIndexes.set(set, index);
  }
  return index;
}

/** Every icon of a set as a `ResolvedIcon`, by name (the same objects `resolveIcon` returns). */
export function resolvedIconsOf(set: IconSet): ReadonlyMap<string, ResolvedIcon> {
  return indexOf(set).byName;
}

/** The icon a reference names, or `null` (unknown set, unknown name, unreadable). */
export function resolveIcon(
  ref: string,
  sets: readonly IconSet[] = ICON_SETS,
): ResolvedIcon | null {
  let cache = refCaches.get(sets);
  if (!cache) {
    cache = new Map();
    refCaches.set(sets, cache);
  }
  const cached = cache.get(ref);
  if (cached !== undefined) return cached;

  let found: ResolvedIcon | null = null;
  const parsed = parseIconRef(ref);
  if (parsed) {
    const set = sets.find((s) => s.id === parsed.set);
    if (set) {
      const index = indexOf(set);
      const name = index.aliases[parsed.name] ?? parsed.name;
      found = index.byName.get(name) ?? null;
    }
  }
  cache.set(ref, found);
  return found;
}

/** The reference the picker writes for an icon. */
export function iconRef(icon: ResolvedIcon): string {
  return `${icon.set}:${icon.name}`;
}

/**
 * The one precedence rule for a node's icon: its own icon if it resolves, else its type's icon,
 * else the neutral fallback. Every surface calls this.
 */
export function nodeIcon(
  node: { icon?: string | null | undefined; type: string },
  sets: readonly IconSet[] = ICON_SETS,
): NodeIconResult {
  const stored = node.icon ?? '';
  const custom = stored === '' ? null : resolveIcon(stored, sets);
  if (custom) return { icon: custom, source: 'custom', unavailable: false };
  const unavailable = stored !== '';

  const typeId = resolveTypeId(node.type);
  const style = typeId === null ? undefined : TYPE_STYLE[typeId];
  const named = style ?? TYPE_FALLBACK;
  // Type icons are lucide names; ICON_SETS always has lucide, even when a test narrows `sets`.
  const icon =
    resolveIcon(`lucide:${named.iconName}`, sets) ?? resolveIcon(`lucide:${named.iconName}`);
  if (!icon) throw new Error(`Type icon "${named.iconName}" is missing from the lucide catalog`);
  return { icon, source: style ? 'type' : 'fallback', unavailable };
}

const chromeCache = new Map<ChromeIconKey, ResolvedIcon>();

/** Geometry of an export-chrome icon (status glyphs, chevrons, …); not part of the picker. */
export function chromeIcon(key: ChromeIconKey): ResolvedIcon {
  let icon = chromeCache.get(key);
  if (!icon) {
    const name = CHROME_ICONS[key];
    const geometry = LUCIDE_GEOMETRY[name];
    if (!geometry) throw new Error(`Chrome icon "${key}" has no generated geometry`);
    icon = { set: 'lucide', name, label: name, node: geometry.node, style: 'line' };
    chromeCache.set(key, icon);
  }
  return icon;
}
