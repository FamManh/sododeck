import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge must know our custom theme keys, or e.g. `text-body text-ink` would be merged as two colors. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display',
        'title-lg',
        'title-md',
        'title-sm',
        'body',
        'body-sm',
        'caption',
        'node-sub',
        'micro',
        'group-label',
        'code',
        'code-sm',
        'edge-label',
      ],
      radius: ['button', 'input', 'node', 'card', 'group', 'deck-card', 'modal'],
      shadow: ['rest', 'float', 'modal', 'selection'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
