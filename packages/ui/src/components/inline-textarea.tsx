import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type * as React from 'react';

import { cn } from '@sododeck/ui/lib/utils';

/**
 * A bare, auto-growing textarea for editing text where it is shown (card titles, notes): no
 * border, background, padding or focus ring, and the caller passes the same type classes as the
 * text it replaces, so starting an edit moves nothing (DESIGN.md inline-edit, founder 2026-10-02).
 * It wraps like the shown text and grows to fit it; `maxHeight` in `style` caps it, and the rest
 * scrolls. The surrounding card or note marks that it is being edited.
 */
const InlineTextarea = forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  function InlineTextarea({ className, value, rows = 1, ...props }, ref) {
    const inner = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

    // Grow with the text: reset, then take the content height (no `field-sizing` in Firefox).
    useLayoutEffect(() => {
      const el = inner.current;
      if (el === null) return;
      el.style.height = '0px';
      el.style.height = `${String(el.scrollHeight)}px`;
    }, [value]);

    return (
      <textarea
        ref={inner}
        data-slot="inline-textarea"
        rows={rows}
        value={value}
        className={cn(
          'm-0 block w-full resize-none overflow-y-auto border-0 bg-transparent p-0 outline-none [scrollbar-width:none] placeholder:text-ink-muted',
          className,
        )}
        {...props}
      />
    );
  },
);

export { InlineTextarea };
