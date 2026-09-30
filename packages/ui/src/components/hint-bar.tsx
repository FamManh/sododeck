import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

export interface HintBarItem {
  /** The key or keys, e.g. "⌥" or "Esc", shown in a Mono key cap. `''` for plain instructional text. */
  keys: string;
  /** What the key does, e.g. "Duplicate". */
  label: string;
}

/**
 * The keyboard hint bar (016, DESIGN.md "Hint bar", screens 108–115): an Inverse pill 30 px
 * tall listing the modifier keys of the running gesture, each as a Mono key cap on a translucent
 * cap and its label. Presentational only: the app places it (bottom centre) and announces the
 * text itself, once per gesture.
 */
function HintBar({
  items,
  className,
  ...props
}: ComponentProps<'div'> & { items: readonly HintBarItem[] }) {
  return (
    <div
      data-slot="hint-bar"
      className={cn(
        'pointer-events-none inline-flex h-[30px] items-center gap-3 rounded-full bg-inverse px-3 text-caption whitespace-nowrap text-on-inverse shadow-hover',
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        <span key={`${item.keys} ${item.label}`} className="inline-flex items-center gap-1.5">
          {item.keys !== '' && (
            <kbd className="rounded-segment bg-on-inverse/28 px-1.5 py-px font-mono text-micro tracking-normal">
              {item.keys}
            </kbd>
          )}
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

export { HintBar };
