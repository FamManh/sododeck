/**
 * The drawer's tag row for one card (033, contracts/tag-ui.md): 21 px pills in each tag's own
 * colour with a remove button, then "Add tag", which opens the tag picker.
 */
import { tagKey } from '@sododeck/model';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { TagChip } from '@sododeck/ui/components/tag-chip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Plus } from 'lucide-react';
import { useRef } from 'react';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { MAX_CARD_TAGS } from '../card-tags';
import { FieldLabel } from '../fields/field-label';
import { tagColourMap, tagLooksOf } from './card-tag-looks';
import { TagPicker } from './tag-picker';
import { tagPickerEscape } from './tag-picker-escape';

export function CardTagsField({
  nodeId,
  tags,
  onCommit,
}: {
  nodeId: string;
  tags: readonly string[] | undefined;
  /** Writes the card's tags (`null` clears the field). */
  onCommit: (tags: string[] | null) => void;
}) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const own = tags ?? [];
  const looks = tagLooksOf(own, tagColourMap(deck.tagColors));
  const full = own.length >= MAX_CARD_TAGS;

  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const addButton = useRef<HTMLButtonElement>(null);

  const remove = (text: string) => {
    const index = own.findIndex((tag) => tagKey(tag) === tagKey(text));
    const following = own[index + 1];
    const next = own.filter((tag) => tagKey(tag) !== tagKey(text));
    onCommit(next.length === 0 ? null : next);
    useUiStore.getState().announce(`${text} removed`);
    // Focus the next pill once the removed one is gone, else "Add tag" (FR-007).
    queueMicrotask(() => {
      const target =
        following === undefined ? undefined : removeButtons.current.get(tagKey(following));
      (target ?? addButton.current)?.focus();
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Tags</FieldLabel>
      <ul aria-label="Tags" className="flex flex-wrap items-center gap-1.5">
        {looks.map((look, index) => (
          <li key={`${String(index)}:${look.text}`}>
            <TagChip
              size="deck"
              label={look.text}
              colour={{ chip: look.chip, ink: look.ink }}
              removeRef={(button) => {
                if (button) removeButtons.current.set(tagKey(look.text), button);
                else removeButtons.current.delete(tagKey(look.text));
              }}
              onRemove={() => {
                remove(look.text);
              }}
            />
          </li>
        ))}
        <li>
          {full ? (
            <span className="text-caption text-ink-secondary">{MAX_CARD_TAGS} tags max</span>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  ref={addButton}
                  type="button"
                  aria-label="Add tag"
                  className={cn(
                    'inline-flex h-[21px] cursor-pointer items-center gap-1 rounded-full border border-dashed border-ink-muted px-2 text-[10.5px] leading-none font-medium text-ink-secondary hover:text-ink',
                    focusRing,
                  )}
                >
                  <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
                  Add tag
                </button>
              </PopoverTrigger>
              <PopoverContent aria-label="Tags" onEscapeKeyDown={tagPickerEscape}>
                <TagPicker nodeIds={[nodeId]} />
              </PopoverContent>
            </Popover>
          )}
        </li>
      </ul>
    </div>
  );
}
