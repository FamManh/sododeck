import { Button } from '@sododeck/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow, useStore, useViewport } from '@xyflow/react';
import { Expand, Map as MapIcon, Minus, Plus, SquareDashed } from 'lucide-react';
import type { ReactNode } from 'react';

import { useUiStore } from '../../state/ui-store';
import { canvasElement } from '../canvas-actions';
import { LevelIndicator } from '../level-indicator';
import { effectiveLevel, levelSelector } from '../levels';
import { scopeOf } from '../visible-graph';
import { MAX_ZOOM, MIN_ZOOM } from '../zoom-limits';
import { useFitSelection } from './fit-selection';
import { Island, IslandDivider } from './island';
import { EDGE } from './shell-geometry';
import { shortcutLabel, type ShortcutId } from './shortcuts';
import { TableDetailControl } from './table-detail-control';
import { useCompactShell } from './use-compact-shell';

function ZoomButton({
  label,
  shortcut,
  children,
  ...props
}: {
  label: string;
  shortcut: ShortcutId;
  children: ReactNode;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  const { pressed, ...rest } = props;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            pressed === true && 'bg-primary-soft text-primary-ink hover:bg-primary-soft',
          )}
          {...rest}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} · {shortcutLabel(shortcut)}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The zoom island, bottom-right (018 FR-033, design 86): fit (⇧1), fit selection (⇧2), zoom
 * out / level / in, the semantic level (010), the deck's table detail (041), the minimap (M) and
 * the keyboard shortcuts (?).
 * It moves above the JSON overlay when that is open (`bottom`) and left of the drawer (`right`).
 */
export function ZoomIsland({ bottom, right = EDGE }: { bottom: number; right?: number }) {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, fitView, screenToFlowPosition, setCenter } = useReactFlow();
  const zoomLevel = useStore(levelSelector);
  const drill = useUiStore((s) => s.drill);
  const hasSelection = useUiStore((s) => s.selection.nodes.length + s.selection.groups.length > 0);
  const minimap = useUiStore((s) => s.minimap);
  const setMinimap = useUiStore((s) => s.setMinimap);
  const fitSelection = useFitSelection();
  const compact = useCompactShell();
  const scope = scopeOf(drill);
  const level = effectiveLevel(zoomLevel, scope);
  // Compare in whole percents: floating zoom never lands exactly on the limit.
  const percent = Math.round(zoom * 100);

  const zoomTo = (nextZoom: number) => {
    const rect = canvasElement()?.getBoundingClientRect();
    const point =
      rect === undefined
        ? { x: 0, y: 0 }
        : screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    void setCenter(point.x, point.y, { zoom: nextZoom });
  };

  return (
    <Island region="zoom" label="Zoom" style={{ bottom, right }}>
      <ZoomButton label="Fit diagram" shortcut="fit" onClick={() => void fitView({ padding: 0.2 })}>
        {/* Arrows out: the whole diagram; a dashed box: the selection (§g-60, they looked alike). */}
        <Expand />
      </ZoomButton>
      <ZoomButton
        label="Fit selection"
        shortcut="fit-selection"
        disabled={!hasSelection}
        onClick={fitSelection}
      >
        <SquareDashed />
      </ZoomButton>
      <IslandDivider />
      <ZoomButton
        label="Zoom out"
        shortcut="zoom-out"
        disabled={percent <= MIN_ZOOM * 100}
        onClick={() => void zoomOut()}
      >
        <Minus />
      </ZoomButton>
      <span className="w-11 text-center font-mono text-code-sm text-ink-secondary" aria-live="off">
        {percent}%
      </span>
      <ZoomButton
        label="Zoom in"
        shortcut="zoom-in"
        disabled={percent >= MAX_ZOOM * 100}
        onClick={() => void zoomIn()}
      >
        <Plus />
      </ZoomButton>
      <LevelIndicator level={level} scope={scope} onZoomTo={zoomTo} />
      {/* Deck detail of tables (041), only in a deck with a table. */}
      <TableDetailControl compact={compact} />
      <IslandDivider />
      <ZoomButton
        label="Minimap"
        shortcut="minimap"
        pressed={minimap}
        onClick={() => {
          setMinimap(!minimap);
        }}
      >
        <MapIcon />
      </ZoomButton>
    </Island>
  );
}
