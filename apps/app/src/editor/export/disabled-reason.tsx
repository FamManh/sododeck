import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { useId, type ReactNode } from 'react';

/**
 * A disabled segmented item with the reason as a tooltip (hover) and as its description
 * (screen readers). Disabled radios cannot take focus, so the reason is not keyboard-reachable
 * as a tooltip; the description carries it instead.
 */
export function DisabledReason({
  reason,
  children,
}: {
  reason: string | null;
  children: ReactNode;
}) {
  const id = useId();
  if (reason === null) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-full w-full" aria-describedby={id}>
          {children}
          <span id={id} className="sr-only">
            {reason}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
