import { CircleAlert, CircleCheck, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

type BannerTone = 'warning' | 'success' | 'error';

/** Each tone has its own icon, so the type is recognisable without color. */
const TONES: Record<BannerTone, { icon: LucideIcon; classes: string; role: 'status' | 'alert' }> = {
  warning: { icon: TriangleAlert, classes: 'bg-amber-soft text-amber-ink', role: 'status' },
  success: { icon: CircleCheck, classes: 'bg-success-soft text-success-ink', role: 'status' },
  error: { icon: CircleAlert, classes: 'bg-clay-soft text-clay-ink', role: 'alert' },
};

type BannerProps = React.ComponentProps<'div'> & {
  tone: BannerTone;
  /** Optional action, e.g. a button, shown after the message. */
  action?: React.ReactNode;
  /** Shows a Dismiss button. */
  onDismiss?: () => void;
};

/** Inline banner: amber warning (backup), success, clay error (DESIGN.md banner). */
function Banner({ tone, action, onDismiss, className, children, ...props }: BannerProps) {
  const { icon: Icon, classes, role } = TONES[tone];
  return (
    <div
      data-slot="banner"
      data-tone={tone}
      role={role}
      className={cn(
        'flex items-start gap-2.5 rounded-banner px-3.5 py-3 text-body',
        classes,
        className,
      )}
      {...props}
    >
      <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="mt-0.5 size-4.5 shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={cn(
            '-my-0.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-segment opacity-80 hover:opacity-100',
            focusRing,
          )}
        >
          <X aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
        </button>
      )}
    </div>
  );
}

export { Banner };
