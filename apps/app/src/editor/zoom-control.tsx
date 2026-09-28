import { Button } from '@sododeck/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { useReactFlow, useViewport } from '@xyflow/react';
import { Maximize, Minus, Plus } from 'lucide-react';

import { isApplePlatform } from '../lib/features';
import { canvasElement } from './canvas-actions';
import { LevelIndicator } from './level-indicator';
import type { Level } from './levels';
import type { Scope } from './visible-graph';

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;

/** Zoom −, %, +, fit (design 02, FR-022). Replaces React Flow's Controls. */
export function ZoomControl({
  level = 'system',
  scope = { node: null, group: null },
}: {
  level?: Level;
  scope?: Scope;
}) {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, fitView, screenToFlowPosition, setCenter } = useReactFlow();
  const mod = isApplePlatform() ? '⌘' : 'Ctrl+';
  // Compare in whole percents: floating zoom never lands exactly on the limit.
  const percent = Math.round(zoom * 100);

  const zoomTo = (nextZoom: number) => {
    const rect = canvasElement()?.getBoundingClientRect();
    const point =
      rect === undefined
        ? { x: 0, y: 0 }
        : screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
    void setCenter(point.x, point.y, { zoom: nextZoom });
  };

  return (
    <div className="flex items-center gap-0.5 rounded-card border border-hairline bg-surface p-1 shadow-rest">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={percent <= MIN_ZOOM * 100}
            onClick={() => void zoomOut()}
          >
            <Minus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom out · {mod}−</TooltipContent>
      </Tooltip>
      <span className="w-12 text-center font-mono text-code-sm text-ink-secondary" aria-live="off">
        {percent}%
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={percent >= MAX_ZOOM * 100}
            onClick={() => void zoomIn()}
          >
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom in · {mod}+</TooltipContent>
      </Tooltip>
      <LevelIndicator level={level} scope={scope} onZoomTo={zoomTo} />
      <span aria-hidden className="mx-0.5 h-4 w-px bg-hairline" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fit diagram"
            onClick={() => void fitView({ padding: 0.2 })}
          >
            <Maximize />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit diagram · {mod}0</TooltipContent>
      </Tooltip>
    </div>
  );
}
