import { Switch as SwitchPrimitive } from 'radix-ui';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

/**
 * 32×18 toggle switch: off = surface-3 track, on = Deck Orange. The thumb position also
 * shows the state. The off track is below 3:1 by design (founder-approved exception, plan.md),
 * so a switch always needs a visible label next to it.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full bg-surface-3 p-0.5 transition-colors duration-(--sd-dur-ring) disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        focusRing,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-3.5 rounded-full bg-surface shadow-rest transition-transform duration-(--sd-dur-ring) data-[state=checked]:translate-x-3.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
