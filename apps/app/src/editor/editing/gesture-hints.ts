/** Hint bar items and texts per canvas gesture (016 R13, contract "Hint bar texts"). */
import type { HintBarItem } from '@sododeck/ui/components/hint-bar';

import { isApplePlatform } from '../../lib/features';
import type { CanvasGesture } from '../../state/ui-store';

const HINTS: Partial<Record<CanvasGesture, readonly HintBarItem[]>> = {
  marquee: [
    { keys: '⇧', label: 'Add' },
    { keys: '⌥', label: 'Touch' },
    { keys: 'Esc', label: 'Cancel' },
  ],
  drag: [
    { keys: '⌥', label: 'Duplicate / No group' },
    { keys: '⇧', label: 'Lock axis' },
    { keys: '⌘', label: 'No snap' },
    { keys: 'Esc', label: 'Cancel' },
  ],
  'group-drag': [
    { keys: '⌥', label: 'Duplicate' },
    { keys: '⇧', label: 'Lock axis' },
    { keys: '⌘', label: 'No snap' },
    { keys: 'Esc', label: 'Cancel' },
  ],
  resize: [
    { keys: '⇧', label: 'Keep ratio' },
    { keys: '⌥', label: 'From centre' },
    { keys: 'Esc', label: 'Cancel' },
  ],
  'card-resize': [
    { keys: '⇧', label: 'Keep ratio' },
    { keys: '⌥', label: 'From centre' },
    { keys: '⌘', label: 'No snap' },
    { keys: 'Esc', label: 'Cancel' },
  ],
  bend: [
    { keys: '⌘', label: 'No snap' },
    { keys: 'R', label: 'Reset route' },
    { keys: 'Esc', label: 'Cancel' },
  ],
  anchor: [
    { keys: '⌘', label: 'No snap' },
    { keys: 'Esc', label: 'Cancel' },
  ],
  label: [
    { keys: '⌘', label: 'No snap' },
    { keys: 'Esc', label: 'Cancel' },
  ],
  endpoint: [
    { keys: '', label: 'Drop on a side to pin it' },
    { keys: 'Esc', label: 'Keep old end' },
  ],
};

const OTHER_KEYS: Readonly<Record<string, string>> = { '⌥': 'Alt', '⌘': 'Ctrl', '⇧': 'Shift' };

/** The hint items for a gesture, with Alt / Ctrl / Shift outside macOS. */
export function gestureHint(
  gesture: CanvasGesture | null,
  apple = isApplePlatform(),
): readonly HintBarItem[] {
  const items = gesture === null ? undefined : HINTS[gesture];
  if (items === undefined) return [];
  return apple
    ? items
    : items.map((item) => ({ ...item, keys: OTHER_KEYS[item.keys] ?? item.keys }));
}

/** "⇧ Add · ⌥ Touch · Esc Cancel" */
export function hintText(items: readonly HintBarItem[]): string {
  return items
    .map((item) => (item.keys === '' ? item.label : `${item.keys} ${item.label}`))
    .join(' · ');
}
