/**
 * The drawer's header tile as the "Change icon" button (038 T028): the 40 px tile of the card's
 * type (or its own icon), a pencil badge on hover / focus, and the picker in a popover anchored
 * to it. A node drawn as a shape, or any mode but editing, keeps the plain tile. There is no Icon
 * row in the appearance section: this tile is the one drawer entry point (founder, 2026-10-04).
 */
import { effectiveFamily } from '@sododeck/model';
import type { Node } from '@sododeck/schema';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { nodeIcon } from '@sododeck/ui/icon-sets';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { Pencil, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { useUiStore } from '../../state/ui-store';
import { modeOf } from '../actions/use-action-context';
import { NodeTypeTile } from '../shapes/shape-tile';
import { IconField } from './icon-field';

export function IconTileButton({ node }: { node: Node }) {
  const [open, setOpen] = useState(false);
  const editing = useUiStore((s) => modeOf(s) === 'edit');
  const resolved = nodeIcon({ icon: node.icon, type: node.type });
  const tile = (
    <NodeTypeTile
      type={node.type}
      size={40}
      decorative
      {...(effectiveFamily(node) === 'card' ? { icon: resolved.icon } : {})}
    />
  );
  if (effectiveFamily(node) !== 'card' || !editing) return tile;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Change icon"
              aria-haspopup="dialog"
              className={cn('group relative shrink-0 rounded-card', focusRing)}
            >
              {tile}
              {resolved.unavailable && (
                <span
                  data-unavailable
                  aria-hidden
                  className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-soft text-amber-ink"
                >
                  <TriangleAlert className="size-2.5" />
                </span>
              )}
              <span
                aria-hidden
                className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-hairline bg-surface text-ink-secondary opacity-0 shadow-rest transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                <Pencil className="size-2.5" />
              </span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {resolved.unavailable && node.icon !== undefined ? (
            <>
              <code className="font-mono">{node.icon}</code> · Icon not available in this version
            </>
          ) : resolved.source === 'custom' ? (
            resolved.icon.label
          ) : (
            'Type icon'
          )}
        </TooltipContent>
      </Tooltip>
      <PopoverContent aria-label="Choose icon" align="start" className="w-[320px] shadow-menu">
        <IconField
          selection={{ nodes: [node.id], edges: [], groups: [], stickies: [], images: [] }}
          onDone={() => {
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
