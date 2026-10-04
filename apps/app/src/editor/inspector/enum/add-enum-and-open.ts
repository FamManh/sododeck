import type { DeckEditor } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { createEnum } from '../../../db/enum-edits';
import { useUiStore } from '../../../state/ui-store';

/**
 * "Add enum" from the Add flyout, the canvas menu and Deck settings (052): one `enum_n` with no
 * values (one undo step), then the enum drawer with its name selected so typing renames it.
 */
export function addEnumAndOpen(editor: DeckEditor, deck: SododeckFile): Id {
  const id = createEnum(editor, deck);
  const ui = useUiStore.getState();
  ui.openEnumDrawer(id, { selectName: true });
  ui.announce('Enum added');
  return id;
}
