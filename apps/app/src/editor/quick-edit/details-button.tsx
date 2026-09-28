import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { PanelRight } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';

/**
 * The round details button on a card's top-right corner (019 US4, R4). It shows on hover or
 * focus inside the card; `sd-details-button` is hidden by CSS flags on the canvas wrapper
 * (dragging, flow mode, a session, Hide UI, tiny cards), so no card subscribes to the zoom.
 */
export function DetailsButton({
  id,
  title,
  focused,
}: {
  id: string;
  title: string;
  /** The card holds the canvas's Tab stop (roving focus): the button is reachable too. */
  focused: boolean;
}) {
  const open = () => {
    const ui = useUiStore.getState();
    ui.select({ nodes: [id] });
    ui.focus(id);
    ui.openDrawer();
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Open details for ${title}`}
          tabIndex={focused ? 0 : -1}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            open();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            // Enter / Space activate the button; they must not reach the canvas keys.
            if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
          }}
          className={cn(
            'sd-details-button nodrag nopan absolute -top-2.5 -right-2.5 z-10 flex size-[22px] cursor-pointer items-center justify-center rounded-full bg-inverse text-on-inverse opacity-0 shadow-rest group-hover/node:opacity-100 group-focus-within/node:opacity-100',
            focusRing,
          )}
        >
          <PanelRight aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Open details</TooltipContent>
    </Tooltip>
  );
}
