import { isDbTable } from '@sododeck/model';
import type { Node, SododeckFile } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';

import { databaseCards, ownerOf } from '../../db/owner';
import { useEditor } from '../../model/use-editor';
import { moveDisabledReason, moveTableTo } from '../actions/db-actions';
import { PickField } from '../fields/pick-field';

const NO_DATABASE = '';

/**
 * A table's "Database" field (049 US1): the card that owns it. Picking another card is "Move to
 * database…", picking "No database" is "Remove from card"; both run the menu actions' function,
 * so they share the lock, placement and the one undo step.
 */
export function TableOwnerField({ deck, node }: { deck: SododeckFile; node: Node }) {
  const editor = useEditor();
  if (!isDbTable(node)) return null;
  const owner = ownerOf(deck, node.id);
  const reason = moveDisabledReason(deck, node);
  const options = [
    ...databaseCards(deck).map((card) => ({ value: card.id, label: card.title })),
    { value: NO_DATABASE, label: 'No database' },
  ];
  return (
    <PanelSection>
      <PickField
        label="Database"
        listLabel="Database cards"
        value={owner?.id ?? NO_DATABASE}
        options={options}
        disabled={reason !== null}
        {...(reason === null ? {} : { hint: reason })}
        onPick={(value) => {
          moveTableTo(editor, deck, node.id, value === NO_DATABASE ? null : value);
        }}
      />
    </PanelSection>
  );
}
