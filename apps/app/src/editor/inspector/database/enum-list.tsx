import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Plus } from 'lucide-react';
import { useId } from 'react';

import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { addEnumAndOpen } from '../enum/add-enum-and-open';

/** Deck settings › Database › Enums (052): each enum opens its drawer; "Add enum" makes one. */
export function EnumList({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const id = useId();
  const enums = deck.enums ?? [];
  return (
    <>
      <div className="flex items-center justify-between gap-3 pt-2">
        <span id={`${id}-heading`} className="text-caption font-medium text-ink-secondary">
          Enums
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            addEnumAndOpen(editor, deck);
          }}
        >
          <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
          Add enum
        </Button>
      </div>
      {enums.length === 0 ? (
        <p className="text-caption text-ink-secondary">No enums yet.</p>
      ) : (
        <ul aria-labelledby={`${id}-heading`} className="flex flex-col gap-0.5">
          {enums.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  useUiStore.getState().openEnumDrawer(item.id);
                }}
                className={cn(
                  'flex h-8 w-full items-center justify-between gap-3 rounded-row px-2 text-left text-body-sm text-ink hover:bg-surface-2',
                  focusRing,
                )}
              >
                <span className="truncate font-mono">{item.name}</span>
                <span className="shrink-0 text-caption text-ink-secondary">
                  {item.values.length} {item.values.length === 1 ? 'value' : 'values'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
