import { effectiveFamily, type FormNode } from '@sododeck/model';
import { resolveIcon, type ResolvedIcon } from '@sododeck/ui/icon-sets';

/**
 * The stored icon reference of a node that draws as a card; undefined for a node drawn as a shape
 * (038: shapes show no icon, and their stored value is kept untouched).
 */
export function cardIconRef(node: FormNode & { icon?: string }): string | undefined {
  return node.icon !== undefined && effectiveFamily(node) === 'card' ? node.icon : undefined;
}

/**
 * The custom icon a stored reference resolves to, for surfaces that pass it next to the node's
 * type. Undefined when there is none or the app cannot show it, so the surface keeps the type icon.
 */
export function customIcon(ref: string | undefined): ResolvedIcon | undefined {
  return ref === undefined ? undefined : (resolveIcon(ref) ?? undefined);
}
