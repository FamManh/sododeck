/**
 * The tag editor (033, contracts/tag-ui.md), shown inside the tag picker's popover: the colour of
 * one tag for the whole deck. Choosing a colour applies it at once as one undo step. Esc and the
 * Back button return to the list.
 */
import { tagKey } from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import { Input } from '@sododeck/ui/components/input';
import { SwatchGrid, type SwatchOption } from '@sododeck/ui/components/swatch-grid';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { CARD_COLORS, colourName } from '../style/card-style';
import { deckTags, tagColourOf, tagUsage, type TagUsage } from './deck-tags';

const NO_COLOUR = '';

const count = (n: number, noun: string) => `${String(n)} ${noun}${n === 1 ? '' : 's'}`;

/** "2 connections, 1 flow and the deck": the carriers other than cards, or `null` for none. */
function alsoOn(usage: TagUsage): string | null {
  const parts = [
    usage.connections > 0 ? count(usage.connections, 'connection') : null,
    usage.flows > 0 ? count(usage.flows, 'flow') : null,
    usage.steps > 0 ? count(usage.steps, 'step') : null,
    usage.deckTag ? 'the deck' : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  const last = parts.pop();
  return `Also on ${parts.length === 0 ? '' : `${parts.join(', ')} and `}${last ?? ''}`;
}

export function TagEditor({
  tag,
  onBack,
  onRenamed,
  onDeleted,
}: {
  tag: string;
  onBack: () => void;
  /** Called with the tag's new spelling after a rename or merge, so the host can follow it. */
  onRenamed?: (tag: string) => void;
  /** Called after the tag was deleted. */
  onDeleted?: () => void;
}) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const current = tagColourOf(deck, tag);
  const [name, setName] = useState(tag);
  const [problem, setProblem] = useState<string | null>(null);
  const [merge, setMerge] = useState<{ into: string; cards: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const announce = useUiStore.getState().announce;
  const usage = tagUsage(deck, tag);
  const also = alsoOn(usage);

  const submitName = () => {
    const next = name.trim().replace(/\s+/g, ' ');
    if (next === '') {
      setProblem('A tag needs a name');
      return;
    }
    setProblem(null);
    if (next === tag) return;
    const other = deckTags(deck).find((t) => t.key === tagKey(next) && t.key !== tagKey(tag));
    if (other !== undefined) {
      setMerge({ into: other.tag, cards: usage.cards });
      return;
    }
    editor.renameTag(tag, next);
    announce(`${tag} renamed to ${next}`);
    onRenamed?.(next);
  };

  const options: SwatchOption[] = [
    ...CARD_COLORS.map((colour) => ({
      value: colour,
      label: colourName(colour),
      swatch: `var(--color-card-${colour}-chip)`,
      ringSwatch: `var(--color-card-${colour}-dot)`,
    })),
    {
      value: NO_COLOUR,
      label: 'No colour',
      swatch: 'var(--color-surface)',
      ringSwatch: 'var(--color-ink-muted)',
    },
    ...(deck.swatches ?? []).map((hex) => ({ value: hex, label: hex, swatch: hex })),
  ];

  const doMerge = (into: string) => {
    editor.renameTag(tag, into);
    announce(`${tag} merged into ${into}`);
    setMerge(null);
    onRenamed?.(into);
  };

  const doDelete = () => {
    editor.deleteTag(tag);
    announce(`${tag} deleted, removed from ${count(usage.cards, 'card')}`);
    onDeleted?.();
  };

  const choose = (value: string) => {
    const colour = value === NO_COLOUR ? null : value;
    editor.setTagColor(tag, colour);
    useUiStore
      .getState()
      .announce(
        colour === null ? `${tag} colour cleared` : `${tag} colour set to ${colourName(colour)}`,
      );
  };

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onBack();
      }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back to tags"
          // The pencil that opened the editor is gone, so focus starts here and Esc is heard.
          autoFocus
          onClick={onBack}
          className={cn(
            'inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2 hover:text-ink',
            focusRing,
          )}
        >
          <ArrowLeft aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-caption font-medium tracking-wide text-ink-secondary uppercase">
          Edit tag · {tag}
        </h2>
      </div>
      <div className="flex flex-col gap-1">
        <Input
          aria-label="Tag name"
          value={name}
          invalid={problem !== null}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
            setMerge(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submitName();
          }}
        />
        {problem !== null && (
          <p role="alert" className="text-body-sm text-clay-ink">
            {problem}
          </p>
        )}
      </div>
      {merge !== null && (
        <div className="flex flex-col gap-2 rounded-row bg-surface-2 p-2.5">
          <p className="text-body-sm text-ink">
            Merge into “{merge.into}”? {count(merge.cards, 'card')} change
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                doMerge(merge.into);
              }}
            >
              Merge
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMerge(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      <SwatchGrid
        label="Tag colour"
        options={options}
        value={current ?? NO_COLOUR}
        onSelect={choose}
      />
      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        {confirming ? (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm text-ink">
              Delete “{tag}”? It is removed from {count(usage.cards, 'card')}.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={doDelete}>
                Confirm delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                autoFocus
                onClick={() => {
                  setConfirming(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
            }}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-2 rounded-row text-body-sm text-clay-ink hover:bg-surface-2',
              focusRing,
            )}
          >
            <Trash2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
            Delete tag · used on {count(usage.cards, 'card')}
          </button>
        )}
        {also !== null && <p className="text-caption text-ink-secondary">{also}</p>}
      </div>
    </div>
  );
}
