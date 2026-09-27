import { Button } from '@sododeck/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { useReactFlow, useViewport } from '@xyflow/react';
import { Maximize, Minus, Plus } from 'lucide-react';

import { isApplePlatform } from '../lib/features';

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;

/** Zoom −, %, +, fit (design 02, FR-022). Replaces React Flow's Controls. */
export function ZoomControl() {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const mod = isApplePlatform() ? '⌘' : 'Ctrl+';
  // Compare in whole percents: floating zoom never lands exactly on the limit.
  const percent = Math.round(zoom * 100);

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
