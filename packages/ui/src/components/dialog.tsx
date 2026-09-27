import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/**
 * Modal dialog over a scrim: 20px radius, modal shadow (DESIGN.md dialog). Radix traps focus,
 * closes on Escape and backdrop click, and returns focus to the trigger. Fades use the dim
 * duration, which is 0 under reduced motion. Width: override with className (export: 820px).
 */
function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-scrim transition-opacity duration-(--sd-dur-dim) data-[state=closed]:opacity-0 starting:opacity-0"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-48px)] w-[calc(100vw-48px)] max-w-lg -translate-1/2 flex-col gap-4 overflow-y-auto rounded-modal border border-border bg-surface p-6 text-ink shadow-modal transition-opacity duration-(--sd-dur-dim) data-[state=closed]:opacity-0 starting:opacity-0',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className={cn(
            'absolute top-4 right-4 inline-flex size-7 cursor-pointer items-center justify-center rounded-segment text-ink-secondary hover:bg-surface-2 hover:text-ink',
            focusRing,
          )}
        >
          <X aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4.5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1 pr-8', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-wrap items-center justify-end gap-2', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-title-lg', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-body text-ink-secondary', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
