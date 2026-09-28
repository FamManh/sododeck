import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check, Minus } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  /** Visible label, associated with the box (clicking it toggles). */
  label: ReactNode;
};

/**
 * 16px checkbox with its visible label (DESIGN.md form controls). Checked = Deck Orange with a
 * check glyph; mixed shows a dash, so the state is never color-only.
 */
function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  const generated = useId();
  const boxId = id ?? generated;
  return (
    <span data-slot="checkbox-field" className={cn('flex items-center gap-2', className)}>
      <CheckboxPrimitive.Root
        id={boxId}
        data-slot="checkbox"
        className={cn(
          'peer flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-ink-muted bg-surface text-on-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
          focusRing,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center">
          {props.checked === 'indeterminate' ? (
            <Minus aria-hidden strokeWidth={2.5} className="size-3" />
          ) : (
            <Check aria-hidden strokeWidth={ICON_STROKE_WIDTH + 1} className="size-3" />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label
        htmlFor={boxId}
        className="min-w-0 cursor-pointer truncate text-body-sm text-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      >
        {label}
      </label>
    </span>
  );
}

export { Checkbox };
