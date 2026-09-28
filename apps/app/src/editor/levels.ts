import type { SododeckFile } from '@sododeck/schema';

import type { Scope } from './visible-graph';

export type Level = 'landscape' | 'system' | 'container' | 'component';

export const LEVELS = ['landscape', 'system', 'container', 'component'] as const;

export const LEVEL_NAMES: Record<Level, string> = {
  landscape: 'Landscape',
  system: 'System',
  container: 'Container',
  component: 'Component',
};

export const LEVEL_MID_ZOOM: Record<Level, number> = {
  landscape: 0.375,
  system: 0.68,
  container: 1.2,
  component: 1.75,
};

const LANDSCAPE_MAX = 45;
const SYSTEM_MAX = 90;
const CONTAINER_MAX = 150;
const HYSTERESIS = 2;

function zoomPercent(zoom: number): number {
  return Math.round(zoom * 100);
}

export function levelForZoom(zoom: number): Level {
  const percent = zoomPercent(zoom);
  if (percent <= LANDSCAPE_MAX) return 'landscape';
  if (percent <= SYSTEM_MAX) return 'system';
  if (percent <= CONTAINER_MAX) return 'container';
  return 'component';
}

export function levelWithHysteresis(zoom: number, current: Level): Level {
  const percent = zoomPercent(zoom);
  switch (current) {
    case 'landscape':
      return percent <= LANDSCAPE_MAX + HYSTERESIS ? 'landscape' : levelForZoom(zoom);
    case 'system':
      if (percent >= SYSTEM_MAX + HYSTERESIS + 1) return 'container';
      if (percent <= LANDSCAPE_MAX - HYSTERESIS) return 'landscape';
      return 'system';
    case 'container':
      if (percent >= CONTAINER_MAX + HYSTERESIS + 1) return 'component';
      if (percent <= SYSTEM_MAX - HYSTERESIS - 1) return 'system';
      return 'container';
    case 'component':
      return percent <= CONTAINER_MAX - HYSTERESIS - 1 ? 'container' : 'component';
  }
}

export function effectiveLevel(zoomLevel: Level, scope: Scope): Level {
  return scope.node === null ? zoomLevel : 'component';
}

export function nodeLevel(deck: SododeckFile, nodeId: string): Level | undefined {
  const node = deck.nodes.find((entry) => entry.id === nodeId);
  if (node === undefined) return undefined;
  if (node.level !== undefined) return node.level;

  const parentById = new Map(deck.nodes.map((entry) => [entry.id, entry.parent]));
  let depth = 0;
  let current = node.parent;
  const seen = new Set<string>([nodeId]);
  let cyclic = false;
  while (current !== undefined && parentById.has(current)) {
    if (seen.has(current)) {
      cyclic = true;
      break;
    }
    depth += 1;
    seen.add(current);
    current = parentById.get(current);
  }
  if (cyclic) return 'container';
  return depth === 0 ? 'container' : 'component';
}
