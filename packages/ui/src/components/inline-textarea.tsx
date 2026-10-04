import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type * as React from 'react';

import { cn } from '@sododeck/ui/lib/utils';

/**
 * A bare, auto-growing textarea for editing text where it is shown (card titles, notes): no
 * border, background, padding or focus ring, and the caller passes the same type classes as the
 * text it replaces, so starting an edit moves nothing (DESIGN.md inline-edit, founder 2026-10-02).
 * It wraps like the shown text and grows to fit it; `maxHeight` in `style` caps it, and the rest
 * scrolls. The surrounding card or note marks that it is being edited. With `fitWidth` it is one
 * line as wide as its text instead (a label pill); `min-width` / `max-width` classes bound it.
 */
const InlineTextarea = forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'> & { fitWidth?: boolean }
>(function InlineTextarea({ className, value, rows = 1, fitWidth = false, ...props }, ref) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

  // Grow with the text: reset, then take the content height (no `field-sizing` in Firefox).
  useLayoutEffect(() => {
    const el = inner.current;
    if (el === null) return;
    if (fitWidth) {
      // `field-sizing` is not everywhere: measure the one line, as the height is measured below.
      // An empty field is as wide as its placeholder; +2 keeps the caret inside.
      const empty = el.value === '' && el.placeholder !== '';
      if (empty) el.value = el.placeholder;
      el.style.width = '0px';
      el.style.width = `${String(el.scrollWidth + 2)}px`;
      if (empty) el.value = '';
    }
    el.style.height = '0px';
    el.style.height = `${String(el.scrollHeight)}px`;
  }, [value, fitWidth]);

  return (
    <textarea
      ref={inner}
      data-slot="inline-textarea"
      rows={rows}
      value={value}
      className={cn(
        'm-0 block w-full resize-none overflow-y-auto border-0 bg-transparent p-0 outline-none [scrollbar-width:none] placeholder:text-ink-muted',
        fitWidth && 'overflow-hidden whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
});

export { InlineTextarea };
