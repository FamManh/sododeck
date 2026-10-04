import type { Id, SododeckFile } from '@sododeck/schema';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

import { useUiStore } from '../../../state/ui-store';
import { enumUsers } from './enum-users';

/** The columns that use an enum, as chips; a chip opens that column in the table drawer (052). */
export function EnumUsedBy({ deck, enumId }: { deck: SododeckFile; enumId: Id }) {
  const users = enumUsers(deck, enumId);
  if (users.length === 0) {
    return <p className="text-body-sm text-ink-secondary">No column uses this enum yet.</p>;
  }
  return (
    <ul aria-label="Used by" className="flex flex-wrap gap-1.5">
      {users.map((user) => (
        <li key={user.columnId}>
          <button
            type="button"
            onClick={() => {
              useUiStore
                .getState()
                .openTableDrawer(user.tableId, { tab: 'columns', columnId: user.columnId });
            }}
            className={cn(
              'rounded-segment border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-caption text-ink hover:border-border',
              focusRing,
            )}
          >
            {user.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
