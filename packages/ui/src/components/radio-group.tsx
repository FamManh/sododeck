import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { useId, type ReactNode } from 'react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

/**
 * A vertical list of mutually exclusive options (DESIGN.md form controls), on Radix RadioGroup:
 * arrow keys move the selection. Name the group with `aria-label` or `aria-labelledby`.
 */
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('flex flex-col gap-1.5', className)}
      {...props}
    />
  );
}

type RadioGroupItemProps = React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  /** Visible label, associated with the radio (clicking it selects). */
  label: ReactNode;
};

/** 16px radio with its label; checked shows an orange ring and dot, so it is not color-only. */
function RadioGroupItem({ label, className, id, ...props }: RadioGroupItemProps) {
  const generated = useId();
  const itemId = id ?? generated;
  return (
    <span data-slot="radio-field" className={cn('flex items-center gap-2', className)}>
      <RadioGroupPrimitive.Item
        id={itemId}
        data-slot="radio-group-item"
        className={cn(
          'peer flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink-muted bg-surface transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary',
          focusRing,
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="block size-2 rounded-full bg-primary" />
      </RadioGroupPrimitive.Item>
      <label
        htmlFor={itemId}
        className="min-w-0 cursor-pointer truncate text-body-sm text-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      >
        {label}
      </label>
    </span>
  );
}

export { RadioGroup, RadioGroupItem };
