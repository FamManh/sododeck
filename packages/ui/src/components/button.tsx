import { cva, type VariantProps } from 'class-variance-authority';
import { Check } from 'lucide-react';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

/** DESIGN.md: button-primary / button-secondary / button-icon / chip / button-toggle-active. */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-button text-body font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[17px]",
    focusRing,
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'border border-border bg-surface text-ink hover:bg-surface-2',
        ghost: 'text-ink-secondary hover:bg-surface-2 hover:text-ink',
        chip: 'rounded-full bg-surface-2 text-ink-secondary hover:bg-surface-3 hover:text-ink',
        // Pressed look is added by `pressed` (see below) so the state is not color-only.
        toggle:
          'border border-border bg-surface text-ink hover:bg-surface-2 aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:font-semibold aria-pressed:text-primary-ink',
      },
      size: {
        default: 'h-8.5 px-3.5 has-[>svg]:px-3',
        sm: 'h-7 px-2.5 text-body-sm',
        icon: 'size-8.5',
        'icon-sm': 'size-7 rounded-segment',
        chip: "h-6.5 px-2.5 text-body-sm [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Toggle variant only: pressed state, exposed as aria-pressed and shown with a check icon. */
    pressed?: boolean;
  };

function hasAccessibleName(props: ButtonProps): boolean {
  return (
    Boolean(props['aria-label']) ||
    Boolean(props['aria-labelledby']) ||
    typeof props.children === 'string' ||
    typeof props.title === 'string'
  );
}

function Button({
  className,
  variant = 'secondary',
  size = 'default',
  asChild = false,
  pressed,
  children,
  ...props
}: ButtonProps) {
  if (
    import.meta.env.DEV &&
    (size === 'icon' || size === 'icon-sm') &&
    !asChild &&
    !hasAccessibleName({ ...props, children })
  ) {
    console.error('Button: icon-only buttons need an aria-label (constitution VII).');
  }

  const isToggle = variant === 'toggle';
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-pressed={isToggle ? Boolean(pressed) : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {isToggle && pressed && (
            <Check aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          )}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
