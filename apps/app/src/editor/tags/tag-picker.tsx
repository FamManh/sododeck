/**
 * The tag picker (033, contracts/tag-ui.md): pure content for a popover, shared by the drawer tag
 * row, the bulk drawer and the selection toolbar. A search field over the deck's tags (colour dot,
 * name, count), rows that toggle a tag on the selected cards and notes, a "Create tag" row, and a
 * pencil per row that opens the tag editor in the same popover.
 */
import { SearchField } from '@sododeck/ui/components/search-field';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { addTag, normalizeTag, removeTag, tagKey } from '@sododeck/ui/lib/tags';
import { cn } from '@sododeck/ui/lib/utils';
import { Check, Pencil, Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { MAX_CARD_TAGS } from '../card-tags';
import { canonicalTag, deckTags, type DeckTag } from './deck-tags';
import { tagColours } from './tag-colours';
import { TagEditor } from './tag-editor';

type Row = { kind: 'tag'; tag: DeckTag } | { kind: 'create'; text: string };

/** A card or a note the picker writes to: both hold deck tags (053). */
interface Carrier {
  kind: 'node' | 'sticky';
  id: string;
  tags: readonly string[];
}

/** What the picker tags: cards, notes, or both in one undo step. */
export interface TagTargets {
  nodeIds?: readonly string[];
  stickyIds?: readonly string[];
}

export function TagPicker({ nodeIds = [], stickyIds = [] }: TagTargets) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);
  const [refused, setRefused] = useState(false);
  const id = useId();

  useEffect(() => {
    useUiStore.getState().setTagEditing(editing !== null);
    return () => {
      useUiStore.getState().setTagEditing(false);
    };
  }, [editing]);

  const tags = useMemo(() => deckTags(deck), [deck]);
  const nodes = useMemo(
    (): Carrier[] => [
      ...deck.nodes
        .filter((node) => nodeIds.includes(node.id))
        .map((node): Carrier => ({ kind: 'node', id: node.id, tags: node.tags ?? [] })),
      ...deck.stickies
        .filter((sticky) => stickyIds.includes(sticky.id))
        .map((sticky): Carrier => ({ kind: 'sticky', id: sticky.id, tags: sticky.tags ?? [] })),
    ],
    [deck.nodes, deck.stickies, nodeIds, stickyIds],
  );

  if (editing !== null) {
    return (
      <TagEditor
        tag={editing}
        onBack={() => {
          setEditing(null);
        }}
        onRenamed={setEditing}
        onDeleted={() => {
          setEditing(null);
        }}
      />
    );
  }

  const has = (node: Carrier, key: string) => node.tags.some((t) => tagKey(t) === key);
  const full = (node: Carrier) => node.tags.length >= MAX_CARD_TAGS;

  /** One undo step over the selection: off when every card has it, else on where it is missing. */
  const toggle = (text: string) => {
    const key = tagKey(text);
    const announce = useUiStore.getState().announce;
    const onAll = nodes.length > 0 && nodes.every((node) => has(node, key));
    const missing = nodes.filter((node) => !has(node, key));
    const skipped = onAll ? 0 : missing.filter(full).length;
    if (!onAll && skipped > 0 && skipped === missing.length) {
      // Nothing can take it: a card shows at most ten tags (2026-10-03).
      setRefused(true);
      announce(`${String(MAX_CARD_TAGS)} tags max`);
      return;
    }
    setRefused(false);
    // One gesture so cards and notes together are one undo step.
    editor.beginGesture();
    try {
      for (const carrier of nodes) {
        const before = carrier.tags;
        const after = onAll ? removeTag(before, text) : addTag(before, text, MAX_CARD_TAGS);
        if (after === before) continue;
        if (carrier.kind === 'sticky') editor.setStickyTags(carrier.id, after);
        else editor.update('nodes', carrier.id, { tags: after.length === 0 ? null : [...after] });
      }
    } finally {
      editor.endGesture();
    }
    const noun = stickyIds.length > 0 ? 'item' : 'component';
    const cards = `${String(nodes.length)} ${nodes.length === 1 ? noun : `${noun}s`}`;
    announce(
      nodes.length === 1
        ? `${text} ${onAll ? 'removed' : 'added'}`
        : onAll
          ? `Tag ${text} removed from ${cards}`
          : skipped > 0
            ? `Tag ${text} added; items with ${String(MAX_CARD_TAGS)} tags were skipped`
            : `Tag ${text} added to ${cards}`,
    );
  };

  const needle = tagKey(filter);
  const typed = normalizeTag(filter);
  const rows: Row[] = [
    ...tags.filter((tag) => tag.key.includes(needle)).map((tag): Row => ({ kind: 'tag', tag })),
    ...(typed !== null && !tags.some((tag) => tag.key === needle)
      ? [{ kind: 'create', text: typed } as const]
      : []),
  ];
  const activeIndex = Math.min(active, rows.length - 1);
  const rowId = (index: number) => `${id}-row-${String(index)}`;

  const pick = (row: Row) => {
    if (row.kind === 'tag') {
      toggle(row.tag.tag);
      return;
    }
    const text = canonicalTag(deck, row.text);
    if (text === null) return;
    toggle(text);
    setFilter('');
    setActive(0);
  };

  return (
    <div className="flex flex-col gap-2">
      <SearchField
        label="Filter tags"
        autoFocus
        value={filter}
        aria-controls={`${id}-list`}
        aria-activedescendant={activeIndex >= 0 ? rowId(activeIndex) : undefined}
        placeholder="Filter or create a tag"
        onChange={(event) => {
          setFilter(event.target.value);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(Math.min(activeIndex + 1, rows.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(Math.max(activeIndex - 1, 0));
          } else if (event.key === 'Enter') {
            const row = rows[activeIndex];
            if (row === undefined) return;
            event.preventDefault();
            pick(row);
            // Enter submits what was typed, so the next tag starts from an empty search.
            setFilter('');
            setActive(0);
          }
        }}
      />
      <p className="px-2.5 text-caption font-medium tracking-wide text-ink-secondary uppercase">
        Deck tags
      </p>
      <div
        id={`${id}-list`}
        role="listbox"
        aria-label="Deck tags"
        aria-multiselectable
        className="flex max-h-64 flex-col overflow-y-auto"
      >
        {rows.map((row, index) => {
          const isActive = index === activeIndex;
          if (row.kind === 'create') {
            return (
              <div
                key="create"
                id={rowId(index)}
                role="option"
                aria-selected={false}
                aria-label={`Create tag “${row.text}”`}
                data-active={isActive || undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onMouseMove={() => {
                  setActive(index);
                }}
                onClick={() => {
                  pick(row);
                }}
                className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-row px-2.5 text-body-sm text-ink select-none data-[active]:bg-surface-2"
              >
                <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  Create tag <strong className="font-medium">“{row.text}”</strong>
                </span>
              </div>
            );
          }
          const { tag } = row;
          const colours = tagColours(tag.color);
          const onCount = nodes.filter((node) => has(node, tag.key)).length;
          const onAll = nodes.length > 0 && onCount === nodes.length;
          const some = onCount > 0 && !onAll;
          return (
            <div
              key={tag.key}
              role="presentation"
              data-active={isActive || undefined}
              onMouseMove={() => {
                if (!isActive) setActive(index);
              }}
              className="flex h-8 shrink-0 items-center rounded-row data-[active]:bg-surface-2"
            >
              <div
                id={rowId(index)}
                role="option"
                aria-selected={onAll}
                onMouseDown={(event) => {
                  // The search field keeps focus, so the keyboard keeps working after a click.
                  event.preventDefault();
                }}
                onClick={() => {
                  pick(row);
                }}
                className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 px-2.5 text-body-sm text-ink select-none"
              >
                <Check
                  aria-hidden
                  strokeWidth={ICON_STROKE_WIDTH}
                  className={cn('size-4 shrink-0 text-primary-ink', !onAll && 'invisible')}
                />
                <span
                  data-slot="tag-dot"
                  aria-hidden
                  style={{ '--tag-dot': colours.dot, '--tag-chip': colours.chip } as CSSProperties}
                  className="size-3.5 shrink-0 rounded-full border-[1.5px] border-(--tag-dot) bg-(--tag-chip)"
                />
                <span className="min-w-0 flex-1 truncate">{tag.tag}</span>
                <span className="shrink-0 text-caption text-ink-secondary">
                  {some ? `${String(onCount)} of ${String(nodes.length)}` : tag.count}
                </span>
              </div>
              <button
                type="button"
                aria-label={`Edit tag ${tag.tag}`}
                onClick={() => {
                  setEditing(tag.tag);
                }}
                className={cn(
                  'mr-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-surface-3 hover:text-ink',
                  focusRing,
                )}
              >
                <Pencil aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      {refused && (
        <p role="note" className="px-2.5 text-caption text-clay-ink">
          {String(MAX_CARD_TAGS)} tags max
        </p>
      )}
    </div>
  );
}
