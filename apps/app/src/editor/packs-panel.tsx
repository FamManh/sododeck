import { deckPacks, packTypeCount, PACKS } from '@sododeck/model';
import { Switch } from '@sododeck/ui/components/switch';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';

/**
 * "Packs in this deck" (030, frame 127): one switch per pack. Turning a pack off hides its types
 * from Add and the pickers; cards already on the board keep rendering. The last pack on cannot be
 * turned off (the model refuses too). Lives inside the Add flyout; Back or Esc returns to Add.
 */
export function PacksPanel() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const setPalette = useUiStore((s) => s.setPalette);
  const announce = useUiStore((s) => s.announce);
  const headingId = useId();
  const noteId = useId();
  const on = new Set(deckPacks(deck));
  const onKnown = PACKS.filter((pack) => on.has(pack.id));

  const back = () => {
    setPalette({ view: 'types' });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    back();
  };

  return (
    <section aria-labelledby={headingId} onKeyDown={onKeyDown} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back to Add"
          onClick={back}
          className={cn('rounded-row p-1 text-ink-secondary hover:bg-surface-2', focusRing)}
        >
          <ArrowLeft aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
        </button>
        <h3 id={headingId} className="text-title-sm text-ink">
          Packs in this deck
        </h3>
      </div>
      <ul className="flex flex-col gap-1">
        {PACKS.map((pack) => {
          const isOn = on.has(pack.id);
          const lastOn = isOn && onKnown.length === 1 && on.size === 1;
          // Tool tiles (031: Sticky, Frame) count as tiles of the pack, as Add shows them.
          const count = packTypeCount(pack.id) + (pack.tools?.length ?? 0);
          const hintId = `${noteId}-${pack.id}`;
          return (
            <li key={pack.id} className="flex items-center gap-3 rounded-row px-1 py-1.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body text-ink">{pack.name}</span>
                <span className="text-caption text-ink-secondary">
                  {pack.description ?? `${String(count)} ${count === 1 ? 'type' : 'types'}`}
                </span>
                {lastOn && (
                  <span id={hintId} className="text-caption text-ink-secondary">
                    At least one pack stays on
                  </span>
                )}
              </span>
              <span aria-hidden className="text-body-sm text-ink-secondary">
                {isOn ? 'On' : 'Off'}
              </span>
              <Switch
                aria-label={pack.name}
                aria-describedby={lastOn ? hintId : undefined}
                checked={isOn}
                disabled={lastOn}
                onCheckedChange={(next) => {
                  try {
                    editor.setPackOn(pack.id, next);
                    announce(`${pack.name} ${next ? 'on' : 'off'}`);
                  } catch {
                    announce('At least one pack stays on');
                  }
                }}
              />
            </li>
          );
        })}
      </ul>
      <p className="text-caption text-ink-secondary">
        Turning a pack off hides its types from Add. Cards already on the board keep rendering.
      </p>
    </section>
  );
}
