import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@sododeck/ui/lib/utils';

/** DESIGN.md: button-primary / button-secondary / button-icon. */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-button text-body font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-primary-soft disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[17px]",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'border border-border bg-surface text-ink hover:bg-surface-2',
        ghost: 'text-ink-secondary hover:bg-surface-2 hover:text-ink',
      },
      size: {
        default: 'h-8.5 px-3.5 has-[>svg]:px-3',
        sm: 'h-7 px-2.5 text-body-sm',
        icon: 'size-8.5',
        'icon-sm': 'size-7 rounded-[7px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  },
);

function Button({
  className,
  variant = 'secondary',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
