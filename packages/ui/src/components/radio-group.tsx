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
  /** Visible label. The radio is named by it unless `aria-label`/`aria-labelledby` is passed. */
  label: ReactNode;
  /** Optional secondary line under the label; it describes the radio and is clickable too. */
  description?: ReactNode;
};

/**
 * 16px radio with its label; checked shows an orange ring and dot, so it is not color-only.
 * The whole item (`className` goes on it) is a `<label>`, so a click anywhere on it selects:
 * padding, the empty space and the description included (051).
 */
function RadioGroupItem({ label, description, className, id, ...props }: RadioGroupItemProps) {
  const generated = useId();
  const itemId = id ?? generated;
  const labelId = `${itemId}-label`;
  const descriptionId = `${itemId}-description`;
  // The label wraps the description, so name the radio from the label text alone.
  const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
  return (
    <label
      htmlFor={itemId}
      data-slot="radio-field"
      className={cn(
        'flex cursor-pointer flex-col gap-1 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <RadioGroupPrimitive.Item
          id={itemId}
          data-slot="radio-group-item"
          aria-labelledby={named ? undefined : labelId}
          aria-describedby={description === undefined ? undefined : descriptionId}
          className={cn(
            'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink-muted bg-surface transition-colors disabled:cursor-not-allowed data-[state=checked]:border-primary',
            focusRing,
          )}
          {...props}
        >
          <RadioGroupPrimitive.Indicator className="block size-2 rounded-full bg-primary" />
        </RadioGroupPrimitive.Item>
        <span id={labelId} className="min-w-0 flex-1 truncate text-body-sm text-ink">
          {label}
        </span>
      </span>
      {description !== undefined && (
        <span id={descriptionId} className="pl-6 text-caption text-ink-secondary">
          {description}
        </span>
      )}
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
