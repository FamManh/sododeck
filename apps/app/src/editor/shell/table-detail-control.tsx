import { isDbTable, tableDisplayOf, type DeckTableDetail } from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { useCallback, useSyncExternalStore } from 'react';

import { readDeck, subscribeDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { oneStep } from '../fields/one-step';

const OPTIONS: readonly { value: DeckTableDetail; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'names', label: 'Names' },
  { value: 'keys', label: 'Keys' },
  { value: 'all', label: 'All' },
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
 * Deck detail of tables (041 FR-014, research R9): Auto · Names · Keys · All in the zoom island,
 * a dropdown in the compact shell (frame 146). Only in a deck with a table. One undo step.
 */
export function TableDetailControl({ compact }: { compact: boolean }) {
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
  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-haspopup="menu">
            Table detail: {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label="Table detail" align="end">
          <DropdownMenuRadioGroup value={detail} onValueChange={choose}>
            {OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <SegmentedControl aria-label="Table detail" value={detail} onValueChange={choose}>
      {OPTIONS.map((option) => (
        <SegmentedControlItem key={option.value} value={option.value} className="px-2">
          {option.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
