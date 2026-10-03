import { TYPE_FALLBACK, typeStyle } from '@sododeck/ui/lib/icons';
import { render } from '@testing-library/react';
import {
  Calendar,
  CalendarRange,
  ChevronDown,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  DoorOpen,
  Eye,
  Link,
  CornerDownLeft,
  Layers,
  StickyNote,
  Table,
  type LucideIcon,
} from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { ICON_PATHS } from './icon-paths';

const SOURCES: Record<keyof typeof ICON_PATHS, LucideIcon> = {
  client: typeStyle('client').icon,
  gateway: typeStyle('gateway').icon,
  service: typeStyle('service').icon,
  queue: typeStyle('queue').icon,
  database: typeStyle('database').icon,
  external: typeStyle('external').icon,
  component: typeStyle('component').icon,
  task: typeStyle('task').icon,
  decision: typeStyle('decision').icon,
  document: typeStyle('document').icon,
  warehouse: typeStyle('warehouse').icon,
  'truck-route': typeStyle('truck-route').icon,
  issue: typeStyle('issue').icon,
  fallback: TYPE_FALLBACK.icon,
  rules: Table,
  children: Layers,
  sticky: StickyNote,
  chevron: ChevronDown,
  enter: CornerDownLeft,
  'status-circle': Circle,
  'status-circle-dashed': CircleDashed,
  'status-circle-dot': CircleDot,
  'status-circle-check': CircleCheck,
  'status-eye': Eye,
  'status-door-open': DoorOpen,
  date: Calendar,
  'date-range': CalendarRange,
  link: Link,
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
