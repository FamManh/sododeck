import { Toast as ToastPrimitive } from 'radix-ui';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type * as React from 'react';

import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { focusRing } from '@sododeck/ui/lib/focus';
import { MOTION } from '@sododeck/ui/lib/motion';
import { cn } from '@sododeck/ui/lib/utils';

export interface ToastOptions {
  message: string;
  /** Optional action, e.g. { label: 'Undo', onAction }. */
  action?: { label: string; onAction: () => void };
  /** Display time in ms. Default 2600 (--sd-toast). Not shortened under reduced motion. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  open: boolean;
}

interface ToastContextValue {
  toasts: readonly ToastItem[];
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
  remove: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Holds the toast queue (UI-only state). Wrap the app once, and render <Toaster /> inside. */
function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { ...options, id, open: true }]);
    return id;
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({ toasts, toast, dismiss, remove }),
    [toasts, toast, dismiss, remove],
  );

  return (
    <ToastContext value={value}>
      <ToastPrimitive.Provider
        swipeDirection="down"
        duration={MOTION.toastMs}
        label="Notifications"
      >
        {children}
      </ToastPrimitive.Provider>
    </ToastContext>
  );
}

function useToastContext(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

/**
 * `const { toast } = useToast(); toast({ message: 'View saved' })`. `toast` returns an id;
 * `dismiss(id)` closes that toast early (e.g. to replace it with a newer one).
 */
function useToast(): { toast: (options: ToastOptions) => number; dismiss: (id: number) => void } {
  const { toast, dismiss } = useToastContext();
  return { toast, dismiss };
}

/** Renders the queue as inverse pills, bottom centre (DESIGN.md toast). F8 focuses the region. */
function Toaster({ className }: { className?: string }) {
  const { toasts, dismiss, remove } = useToastContext();
  const reduced = useReducedMotion();

  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        'fixed bottom-6 left-1/2 z-[60] flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col items-center gap-2 outline-none',
        className,
      )}
    >
      {toasts.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          data-slot="toast"
          data-reduced-motion={reduced ? 'true' : undefined}
          open={item.open}
          // Background = polite announcement; toasts confirm, they never interrupt.
          type="background"
          duration={item.duration ?? MOTION.toastMs}
          onOpenChange={(open) => {
            if (!open) {
              dismiss(item.id);
              remove(item.id);
            }
          }}
          className={cn(
            'flex min-h-10 items-center gap-3 rounded-full bg-inverse px-4 py-2 text-body text-on-inverse shadow-float',
            !reduced &&
              'transition-[opacity,translate] duration-(--sd-dur-dim) starting:translate-y-2 starting:opacity-0',
          )}
        >
          <ToastPrimitive.Description data-slot="toast-message">
            {item.message}
          </ToastPrimitive.Description>
          {item.action && (
            <ToastPrimitive.Action
              altText={item.action.label}
              onClick={item.action.onAction}
              className={cn(
                'cursor-pointer rounded-segment font-medium text-on-inverse underline underline-offset-2 focus-visible:outline-on-inverse',
                focusRing,
              )}
            >
              {item.action.label}
            </ToastPrimitive.Action>
          )}
        </ToastPrimitive.Root>
      ))}
    </ToastPrimitive.Viewport>
  );
}

export { Toaster, ToastProvider, useToast };
