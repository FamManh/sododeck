import type { KeyboardEvent } from 'react';

import { isTextTarget } from '../lib/is-text-target';
import type { DeckRecord } from '../storage/library-db';
import type { LibraryCommands } from './use-library-commands';

/**
 * Keys on a focused deck card or row (contracts/library-ui.md): F2 renames, ⌘D / Ctrl+D
 * duplicates, Delete / Backspace asks to delete, Shift+F10 or the ContextMenu key opens the
 * menu. Enter opens the deck natively (the name is a link).
 */
export function deckKeyHandler(deck: DeckRecord, commands: LibraryCommands, openMenu: () => void) {
  return (event: KeyboardEvent) => {
    if (event.defaultPrevented || isTextTarget(event.target)) return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key;
    const handled = (() => {
      if ((key === 'F10' && event.shiftKey) || key === 'ContextMenu') {
        openMenu();
        return true;
      }
      if (mod && key.toLowerCase() === 'd') {
        void commands.duplicate(deck);
        return true;
      }
      if (mod || event.altKey) return false;
      if (key === 'F2') {
        commands.startRename(deck);
        return true;
      }
      if (key === 'Delete' || key === 'Backspace') {
        commands.requestDelete(deck);
        return true;
      }
      return false;
    })();
    if (handled) event.preventDefault();
  };
}
