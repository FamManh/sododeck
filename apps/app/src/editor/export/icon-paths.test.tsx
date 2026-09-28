import { KIND_FALLBACK, KIND_STYLE } from '@sododeck/ui/lib/icons';
import { render } from '@testing-library/react';
import { Layers, StickyNote, Table, type LucideIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { ICON_PATHS } from './icon-paths';

const SOURCES: Record<keyof typeof ICON_PATHS, LucideIcon> = {
  client: KIND_STYLE.client.icon,
  gateway: KIND_STYLE.gateway.icon,
  service: KIND_STYLE.service.icon,
  queue: KIND_STYLE.queue.icon,
  database: KIND_STYLE.database.icon,
  external: KIND_STYLE.external.icon,
  fallback: KIND_FALLBACK.icon,
  rules: Table,
  children: Layers,
  sticky: StickyNote,
};

/** The rendered lucide icon's shapes, as `[tag, attributes]` pairs. */
function shapesOf(Icon: LucideIcon): [string, Record<string, string>][] {
  const { container } = render(<Icon />);
  const svg = container.querySelector('svg');
  return [...(svg?.children ?? [])].map((child) => [
    child.tagName,
    Object.fromEntries([...child.attributes].map((attr) => [attr.name, attr.value])),
  ]);
}

describe('ICON_PATHS', () => {
  // A lucide upgrade that redraws an icon fails here instead of drifting from the canvas.
  it.each(Object.entries(SOURCES))('%s matches the installed lucide icon', (name, Icon) => {
    const expected = ICON_PATHS[name as keyof typeof ICON_PATHS].map(([tag, attrs]) => [
      tag,
      Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key, String(value)])),
    ]);
    expect(shapesOf(Icon)).toEqual(expected);
  });
});
