import { Popover as PopoverPrimitive } from 'radix-ui';
import { useId, useMemo, useRef } from 'react';
import type * as React from 'react';

import { Button } from '@sododeck/ui/components/button';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

/** Wrap the element the coach mark points at. */
function CoachMarkAnchor(props: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="coach-mark-anchor" {...props} />;
}

/** Text buttons for the inverse card: ghost's ink-secondary would be ~1.3:1 on inverse. */
const inverseTextButton = cn(
  'h-7 cursor-pointer rounded-segment px-2 text-body-sm font-medium text-on-inverse opacity-80 hover:opacity-100 disabled:cursor-default disabled:opacity-40',
  focusRing,
  'focus-visible:outline-on-inverse',
);

type CoachMarkProps = {
  open: boolean;
  /** 1-based step number. */
  step: number;
  total: number;
  title: React.ReactNode;
  children: React.ReactNode;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
  /** A <CoachMarkAnchor> around the target. Without it, the card is centred in the viewport. */
  anchor?: React.ReactNode;
  side?: React.ComponentProps<typeof PopoverPrimitive.Content>['side'];
};

/**
 * Onboarding tooltip: 300px inverse card with an arrow, "n of N", progress dots and
 * Skip / Back / Next (Done on the last step). Escape skips. Focus moves into the card when it
 * opens and back to where it was when it closes. Step state belongs to the caller.
 */
function CoachMark({
  open,
  step,
  total,
  title,
  children,
  onNext,
  onBack,
  onSkip,
  onFinish,
  anchor,
  side = 'bottom',
}: CoachMarkProps) {
  const titleId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const isLast = step >= total;

  // No anchor: point at the viewport centre so the card is still shown (spec edge case).
  const centre = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () =>
          DOMRect.fromRect({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            width: 0,
            height: 0,
          }),
      },
    }),
    [],
  );

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkip();
      }}
    >
      {anchor ?? <PopoverPrimitive.Anchor virtualRef={centre} />}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="coach-mark"
          aria-labelledby={titleId}
          side={anchor ? side : 'top'}
          align="center"
          sideOffset={10}
          collisionPadding={16}
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          onInteractOutside={(event) => {
            // A click elsewhere should not end the tour; only Skip, Done or Escape do.
            event.preventDefault();
          }}
          className="z-50 flex w-[300px] flex-col gap-3 rounded-banner bg-inverse p-4 text-on-inverse shadow-tour"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption opacity-80">
              {step} of {total}
            </p>
            <div aria-hidden className="flex items-center gap-1">
              {Array.from({ length: total }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1.5 rounded-full bg-on-inverse transition-[width,opacity] duration-(--sd-dur-ring)',
                    index + 1 === step ? 'w-4' : 'w-1.5 opacity-40',
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p id={titleId} className="text-title-sm">
              {title}
            </p>
            <div className="text-body opacity-90">{children}</div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className={inverseTextButton} onClick={onSkip}>
              Skip
            </button>
            <button
              type="button"
              className={cn(inverseTextButton, 'ml-auto')}
              onClick={onBack}
              disabled={step <= 1}
            >
              Back
            </button>
            <Button variant="primary" size="sm" onClick={isLast ? onFinish : onNext}>
              {isLast ? 'Done' : 'Next'}
            </Button>
          </div>
          <PopoverPrimitive.Arrow className="fill-inverse" width={14} height={7} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { CoachMark, CoachMarkAnchor };
