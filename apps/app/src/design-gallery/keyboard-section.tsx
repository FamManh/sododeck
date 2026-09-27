import { GallerySection } from './gallery-section';

const KEYS: [control: string, keys: string][] = [
  ['Button, chip, toggle', 'Tab to focus · Enter or Space to activate'],
  ['Input, inline edit, textarea', 'Type · inline edit: Enter commits, Esc reverts'],
  ['Select', 'Enter/Space/↓ opens · ↑↓ moves · Enter picks · Esc closes'],
  ['Search field', 'Type · Esc clears'],
  ['Segmented control', '← → moves the selection (one tab stop)'],
  ['Switch', 'Space toggles'],
  ['Tag input', 'Enter adds · Backspace/Delete on a chip removes it'],
  ['Dialog', 'Tab stays inside · Esc closes and returns focus'],
  ['Coach mark', 'Tab between Skip/Back/Next · Esc skips'],
  ['Toast', 'F8 jumps to the toast region'],
];

/** Review aid for the keyboard-only pass (US2, quickstart.md §2.3). */
export function KeyboardSection() {
  return (
    <GallerySection
      id="keyboard"
      title="Keyboard and contrast"
      description="Every control shows a 2px orange outline on keyboard focus. Text meets WCAG 2.1 AA in both themes; input borders and the switch-off track are founder-approved exceptions."
    >
      <dl className="grid grid-cols-[220px_1fr] gap-x-4 gap-y-2 text-body">
        {KEYS.map(([control, keys]) => (
          <div key={control} className="contents">
            <dt className="text-ink-secondary">{control}</dt>
            <dd>{keys}</dd>
          </div>
        ))}
      </dl>
    </GallerySection>
  );
}
