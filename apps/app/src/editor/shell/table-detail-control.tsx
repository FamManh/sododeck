import { isDbTable, tableDisplayOf, type DeckTableDetail } from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Rows3 } from 'lucide-react';
import { useCallback, useSyncExternalStore } from 'react';

import { readDeck, subscribeDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { oneStep } from '../fields/one-step';

/** What each choice draws, matching `effectiveDetail` and `table-layout.ts`. */
const OPTIONS: readonly { value: DeckTableDetail; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Every column, shortened for long tables' },
  { value: 'names', label: 'Names', description: 'Table names only, no columns' },
  { value: 'keys', label: 'Keys', description: 'Key columns and columns with a relationship' },
  { value: 'all', label: 'All', description: 'Every column with its type' },
];

function isDetail(value: string): value is DeckTableDetail {
  return OPTIONS.some((option) => option.value === value);
}

/** The deck's table detail, or null when the deck has no table (one string: no re-render per edit). */
function useDeckTableDetail(): DeckTableDetail | null {
  const { doc } = useEditor();
  const subscribe = useCallback((listener: () => void) => subscribeDeck(doc, listener), [doc]);
  return useSyncExternalStore(subscribe, () => {
    const deck = readDeck(doc);
    return deck.nodes.some(isDbTable) ? tableDisplayOf(deck).detail : null;
  });
}

/**
 * Deck detail of tables (041 FR-014, research R9; one compact menu since 054): the trigger shows
 * the current choice, each option says what it draws. Only in a deck with a table. One undo step.
 */
export function TableDetailControl() {
  const editor = useEditor();
  const detail = useDeckTableDetail();
  if (detail === null) return null;
  const choose = (value: string) => {
    if (!isDetail(value) || value === detail) return;
    oneStep(editor, () => {
      editor.setTableDisplay({ detail: value === 'auto' ? null : value });
    });
  };
  const label = OPTIONS.find((option) => option.value === detail)?.label ?? 'Auto';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-haspopup="menu">
          <Rows3 aria-hidden />
          Detail: {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Table detail" align="end">
        <DropdownMenuRadioGroup value={detail} onValueChange={choose}>
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              aria-label={option.label}
              aria-describedby={`table-detail-${option.value}`}
              className="flex-col items-start gap-0"
            >
              <span>{option.label}</span>
              <span id={`table-detail-${option.value}`} className="text-ink-secondary text-body-sm">
                {option.description}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
