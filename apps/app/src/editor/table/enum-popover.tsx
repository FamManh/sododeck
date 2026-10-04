import type { DbEnum, SododeckFile } from '@sododeck/schema';
import { Popover, PopoverAnchor, PopoverContent } from '@sododeck/ui/components/popover';
import { useRef } from 'react';

import { useUiStore, type EnumPopover as Target } from '../../state/ui-store';
import { enumById } from '../table-keys';
import { enterPopover, leaveEnum } from './enum-hover';

/** The chip a popover is anchored to (it may have scrolled or re-rendered since it opened). */
function chipElement(target: Target): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-node-id="${CSS.escape(target.nodeId)}"] [data-enum-column="${CSS.escape(target.columnId)}"]`,
  );
}

function enumOf(deck: SododeckFile, target: Target): DbEnum | undefined {
  const node = deck.nodes.find((n) => n.id === target.nodeId);
  const enumRef = node?.columns?.find((c) => c.id === target.columnId)?.enumRef;
  return enumRef === undefined ? undefined : enumById(deck).get(enumRef);
}

/**
 * The one enum values popover of the canvas (041 FR-011, research R7): the enum's name and its
 * values in order with their notes, anchored to the chip that opened it. Mounted once; renders
 * nothing while closed.
 */
export function EnumPopover({ deck }: { deck: SododeckFile }) {
  const target = useUiStore((s) => s.enumPopover);
  if (target === null) return null;
  const item = enumOf(deck, target);
  if (item === undefined) return null;
  return (
    <EnumPopoverContent key={`${target.nodeId}:${target.columnId}`} target={target} item={item} />
  );
}

function EnumPopoverContent({ target, item }: { target: Target; item: DbEnum }) {
  const close = useUiStore((s) => s.closeEnumPopover);
  const virtualRef = useRef({
    getBoundingClientRect: () => chipElement(target)?.getBoundingClientRect() ?? new DOMRect(),
  });
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        aria-label={item.name}
        side="bottom"
        align="end"
        className="w-60 gap-2 p-2.5"
        onPointerEnter={enterPopover}
        onPointerLeave={leaveEnum}
        onOpenAutoFocus={(event) => {
          // A hover shows the values without taking focus from where the user is.
          if (target.source === 'hover') event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Back to the chip, unless another chip's popover replaced this one (that would close it).
          if (target.source === 'keyboard' && useUiStore.getState().enumPopover === null) {
            chipElement(target)?.focus();
          }
        }}
      >
        <span className="font-mono text-[12px] font-medium text-ink">{item.name}</span>
        {item.values.length === 0 ? (
          <span className="text-caption text-ink-muted">No values</span>
        ) : (
          <ul
            aria-label="Values"
            tabIndex={-1}
            className="flex max-h-60 flex-col gap-0.5 overflow-y-auto outline-none"
          >
            {item.values.map((value) => (
              <li key={value.id} className="text-caption text-ink-secondary">
                <span className="font-mono text-ink">{value.name}</span>
                {value.note !== undefined && value.note !== '' && <> — {value.note}</>}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
