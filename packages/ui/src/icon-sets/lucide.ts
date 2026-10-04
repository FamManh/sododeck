import { LUCIDE_CATALOG, LUCIDE_CATEGORIES } from './lucide-catalog';
import { LUCIDE_GEOMETRY } from './lucide.generated';
import type { IconEntry, IconSet } from './types';

const icons: IconEntry[] = LUCIDE_CATALOG.map((entry) => {
  const geometry = LUCIDE_GEOMETRY[entry.name];
  if (!geometry) throw new Error(`No generated geometry for lucide icon "${entry.name}"`);
  return { ...entry, node: geometry.node };
});

/** Old lucide name → current catalog name, so references written with a renamed icon still resolve. */
const aliases: Record<string, string> = {};
for (const entry of LUCIDE_CATALOG) {
  for (const alias of LUCIDE_GEOMETRY[entry.name]?.aliases ?? []) aliases[alias] = entry.name;
}

export const lucide: IconSet = {
  id: 'lucide',
  name: 'Lucide',
  licence: {
    spdx: 'ISC',
    notice: 'Lucide Icons and Contributors; the full text is in third-party-notices.txt.',
  },
  style: 'line',
  icons,
  aliases,
  categories: LUCIDE_CATEGORIES,
};
