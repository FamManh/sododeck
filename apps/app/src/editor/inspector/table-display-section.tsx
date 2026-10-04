import { deckPacks, isDbTable, tableDisplayOf } from '@sododeck/model';
import type { SododeckFile, TableDisplay } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { Switch } from '@sododeck/ui/components/switch';
import { useId } from 'react';

import { useEditor } from '../../model/use-editor';
import { oneStep } from '../fields/one-step';

type HideFlag = 'hideTypes' | 'hideNullable' | 'hideNotes' | 'hideIndexes';

const TOGGLES: readonly { flag: HideFlag; label: string }[] = [
  { flag: 'hideTypes', label: 'Data types' },
  { flag: 'hideNullable', label: 'Nullable marker' },
  { flag: 'hideNotes', label: 'Notes' },
  { flag: 'hideIndexes', label: 'Index footer' },
];

/** The section shows in a deck with a table, or with the Database pack on (041 R10). */
function showsDatabaseSection(deck: SododeckFile): boolean {
  return deck.nodes.some(isDbTable) || deckPacks(deck).includes('database');
}

/**
 * Deck settings › Database (041 FR-019, FR-020, frame 152): "Show on tables" and four switches,
 * all on by default; each writes one hide flag of `tableDisplay` in one undo step. 043 adds the
 * dialect and the rest of the section.
 */
export function TableDisplaySection({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const id = useId();
  if (!showsDatabaseSection(deck)) return null;
  const display = tableDisplayOf(deck);
  return (
    <PanelSection label="Database">
      <span id={`${id}-heading`} className="text-caption font-medium text-ink-secondary">
        Show on tables
      </span>
      <ul aria-labelledby={`${id}-heading`} className="flex flex-col gap-1">
        {TOGGLES.map(({ flag, label }) => (
          <li key={flag} className="flex h-8 items-center justify-between gap-3">
            <label htmlFor={`${id}-${flag}`} className="text-body-sm text-ink">
              {label}
            </label>
            <Switch
              id={`${id}-${flag}`}
              checked={!display[flag]}
              onCheckedChange={(checked) => {
                const patch: Pick<TableDisplay, HideFlag> = { [flag]: !checked };
                oneStep(editor, () => {
                  editor.setTableDisplay(patch);
                });
              }}
            />
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}
