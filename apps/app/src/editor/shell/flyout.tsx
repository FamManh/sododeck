import { Button } from '@sododeck/ui/components/button';
import { cn } from '@sododeck/ui/lib/utils';
import { Pin, PinOff, X } from 'lucide-react';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

import { isTextTarget } from '../../lib/is-text-target';
import { useUiStore } from '../../state/ui-store';
import { flyoutElementId, railButtonId } from './shell-ids';
import type { FlyoutId } from './shell-prefs';

/** Focusable elements, for moving focus into a flyout when it opens. */
const FOCUSABLE =
  'input:not([disabled]), button:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A flyout beside the rail (018 FR-013–FR-016, contract "Flyout"): 280 wide at left 68 / top 68,
 * a non-modal dialog so the canvas stays usable while it is pinned. Opening moves focus into it;
 * Esc clears a filter first, then closes an unpinned flyout (focus back on its rail button) or
 * moves focus to the rail button of a pinned one. A pointer down on the canvas closes an
 * unpinned flyout and still reaches the canvas.
 */
export function Flyout({
  id,
  title,
  children,
}: {
  id: FlyoutId;
  title: string;
  children: ReactNode;
}) {
  const pinned = useUiStore((s) => s.pinnedFlyout === id);
  const togglePin = useUiStore((s) => s.togglePin);
  const closeFlyout = useUiStore((s) => s.closeFlyout);
  const dismissFlyout = useUiStore((s) => s.dismissFlyout);
  const announce = useUiStore((s) => s.announce);
  const headingId = useId();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    // Opening (or swapping to) this flyout moves focus into it, unless the user is typing
    // elsewhere (a pinned flyout coming back must not steal focus from the canvas either).
    const active = document.activeElement;
    const fromRail = active?.closest('[data-region="rail"]') != null;
    const fromBody = active === null || active === document.body;
    if (fromRail || fromBody) ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    announce(`${title} opened`);
  }, [announce, title]);

  useEffect(() => {
    if (pinned) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-testid="shell-canvas"]') === null) return;
      dismissFlyout();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [pinned, dismissFlyout]);

  const railButton = () => document.getElementById(railButtonId(id));

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // A filter with text clears first (SearchField's own Esc); the next Esc closes.
    if (isTextTarget(event.target) && (event.target as HTMLInputElement).value !== '') return;
    event.preventDefault();
    event.stopPropagation();
    const button = railButton();
    if (!pinned) {
      closeFlyout();
      announce(`${title} closed`);
    }
    button?.focus();
  };

  return (
    <section
      ref={ref}
      id={flyoutElementId(id)}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      data-flyout={id}
      onKeyDown={onKeyDown}
      className={cn(
        'sd-overlay-in-left pointer-events-auto absolute top-17 left-17 flex max-h-[calc(100%-80px)] w-70 flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-float',
      )}
    >
      <header className="flex h-11.5 shrink-0 items-center gap-1 border-b border-hairline pr-2 pl-4">
        <h2 id={headingId} className="flex-1 truncate text-title-sm">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Pin ${title}`}
          aria-pressed={pinned}
          className={cn(pinned && 'bg-primary-soft text-primary-ink hover:bg-primary-soft')}
          onClick={() => {
            togglePin();
            announce(pinned ? `${title} unpinned` : `${title} pinned`);
          }}
        >
          {pinned ? <PinOff /> : <Pin />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Close ${title}`}
          onClick={() => {
            closeFlyout();
            announce(`${title} closed`);
            railButton()?.focus();
          }}
        >
          <X />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">{children}</div>
    </section>
  );
}
