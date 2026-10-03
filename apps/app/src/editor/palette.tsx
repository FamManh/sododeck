import { CATEGORIES, deckPacks, isKnownPack, typesOfPacks, type CardType } from '@sododeck/model';
import { SearchField } from '@sododeck/ui/components/search-field';
import { TypeTile } from '@sododeck/ui/components/type-tile';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow } from '@xyflow/react';
import { ChevronRight, Package } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { PALETTE_INITIAL, useUiStore } from '../state/ui-store';
import { addComponent, canvasElement, centredOn, PALETTE_ID } from './canvas-actions';
import { PacksPanel } from './packs-panel';
import { addNoteAt, notesAreReadOnly } from './stickies/sticky-actions';
import { NOTE_MIME, TYPE_MIME } from './use-canvas-handlers';

const COLUMNS = 3;
/** The search field of the flyout, found by `/` (see `use-shell-shortcuts`). */
export const PALETTE_SEARCH_ID = 'palette-search';

interface Section {
  id: string;
  name: string;
  types: readonly CardType[];
}

/** The tile that arrow `key` moves to, by section row and column (a short last row is clamped). */
function neighbour(sections: readonly Section[], from: string, key: string): string | null {
  const flat = sections.flatMap((s) => s.types.map((t) => t.id));
  const at = flat.indexOf(from);
  if (at < 0) return null;
  if (key === 'ArrowRight') return flat[at + 1] ?? null;
  if (key === 'ArrowLeft') return flat[at - 1] ?? null;
  const si = sections.findIndex((s) => s.types.some((t) => t.id === from));
  const section = sections[si];
  if (section === undefined) return null;
  const i = section.types.findIndex((t) => t.id === from);
  const col = i % COLUMNS;
  if (key === 'ArrowDown') {
    if (i + COLUMNS < section.types.length) return section.types[i + COLUMNS]?.id ?? null;
    const next = sections[si + 1];
    return next === undefined
      ? null
      : (next.types[Math.min(col, next.types.length - 1)]?.id ?? null);
  }
  if (key === 'ArrowUp') {
    if (i - COLUMNS >= 0) return section.types[i - COLUMNS]?.id ?? null;
    const prev = sections[si - 1];
    if (prev === undefined) return null;
    const lastRow = Math.floor((prev.types.length - 1) / COLUMNS) * COLUMNS;
    return prev.types[Math.min(lastRow + col, prev.types.length - 1)]?.id ?? null;
  }
  return null;
}

/**
 * The Add flyout (030, frame 127): search, category tabs, sections of type tiles, the Note card
 * and the "Packs" footer. Tiles add at the centre of the view (click, Enter, Space, keys 1–9) or
 * are dragged onto the canvas. Which types are listed comes from the deck's packs.
 */
export function Palette() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const { screenToFlowPosition } = useReactFlow();
  const readOnly = notesAreReadOnly();
  const { search, tab, view } = useUiStore((s) => s.addFlyout);
  const setPalette = useUiStore((s) => s.setPalette);
  const [active, setActive] = useState<string | null>(null);
  const tiles = useRef(new Map<string, HTMLButtonElement>());

  const stored = deck.packs;
  const packs = useMemo(() => deckPacks({ packs: stored }), [stored]);
  const onTypes = useMemo(() => typesOfPacks(packs), [packs]);
  const tabs = useMemo(
    () => CATEGORIES.filter((c) => onTypes.some((t) => t.category === c.id)),
    [onTypes],
  );
  const shownTab = tabs.some((c) => c.id === tab) ? tab : 'all';
  const query = search.trim().toLowerCase();

  const sections: Section[] = useMemo(
    () =>
      tabs
        .filter((c) => shownTab === 'all' || c.id === shownTab)
        .map((c) => ({
          id: c.id,
          name: c.name,
          types: onTypes.filter(
            (t) => t.category === c.id && (query === '' || t.name.toLowerCase().includes(query)),
          ),
        }))
        .filter((s) => s.types.length > 0),
    [tabs, onTypes, shownTab, query],
  );
  const visible = useMemo(() => sections.flatMap((s) => s.types.map((t) => t.id)), [sections]);

  // Keys 1–9 read this list from the store, so it must match what is on screen.
  const visibleKey = view === 'types' ? visible.join(' ') : '';
  useEffect(() => {
    setPalette({ visible: visibleKey === '' ? [] : visibleKey.split(' ') });
  }, [setPalette, visibleKey]);
  useEffect(
    () => () => {
      useUiStore.getState().setPalette(PALETTE_INITIAL);
    },
    [],
  );

  // Coming back from "Packs in this deck" lands on the search field.
  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === 'packs' && view === 'types') {
      document.getElementById(PALETTE_SEARCH_ID)?.focus();
    }
    lastView.current = view;
  }, [view]);

  // A focused tile whose type just left the list (its pack went off) hands focus to the first
  // remaining tile instead of dropping it on the page.
  useEffect(() => {
    if (active === null || visible.includes(active)) return;
    const stray = document.activeElement;
    if (stray !== null && stray !== document.body) return;
    const next = visible[0];
    if (next !== undefined) tiles.current.get(next)?.focus();
  }, [active, visible]);

  const centrePoint = () => {
    const rect = canvasElement()?.getBoundingClientRect();
    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    });
  };
  const addAtCentre = (type: string) => {
    addComponent(editor, type, centredOn(centrePoint()), { edit: true });
  };

  if (view === 'packs') return <PacksPanel />;

  const tabIds = ['all', ...tabs.map((c) => c.id)];
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = tabIds[(tabIds.indexOf(shownTab) + step + tabIds.length) % tabIds.length];
    if (next === undefined) return;
    setPalette({ tab: next });
    document.getElementById(`palette-tab-${next}`)?.focus();
  };
  const onTileKey = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!event.key.startsWith('Arrow')) return;
    const next = neighbour(sections, id, event.key);
    event.preventDefault();
    if (next === null) return;
    setActive(next);
    tiles.current.get(next)?.focus();
  };
  const focusId = active !== null && visible.includes(active) ? active : (visible[0] ?? null);
  const onPacksCount = packs.filter(isKnownPack).length;
  let number = 0;

  return (
    <section id={PALETTE_ID} aria-label="Add" className="flex flex-col gap-3">
      <SearchField
        id={PALETTE_SEARCH_ID}
        label="Search types"
        placeholder="Search types…"
        shortcut="/"
        value={search}
        onChange={(event) => {
          setPalette({ search: event.target.value });
        }}
        onClear={() => {
          setPalette({ search: '' });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            const first = visible[0];
            if (first === undefined) return;
            event.preventDefault();
            addAtCentre(first);
            if (useUiStore.getState().pinnedFlyout !== 'palette')
              useUiStore.getState().closeFlyout();
          } else if (event.key === 'ArrowDown' && focusId !== null) {
            event.preventDefault();
            tiles.current.get(focusId)?.focus();
          }
        }}
      />
      <div role="tablist" aria-label="Categories" className="flex flex-wrap gap-1.5">
        {tabIds.map((id) => {
          const selected = id === shownTab;
          return (
            <button
              key={id}
              id={`palette-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setPalette({ tab: id });
              }}
              onKeyDown={onTabKey}
              className={cn(
                'rounded-full border px-3 py-1 text-body-sm transition-colors',
                selected
                  ? 'border-transparent bg-inverse text-on-inverse'
                  : 'border-hairline bg-surface text-ink-secondary hover:border-border',
                focusRing,
              )}
            >
              {id === 'all' ? 'All' : (CATEGORIES.find((c) => c.id === id)?.name ?? id)}
            </button>
          );
        })}
      </div>
      {sections.length === 0 ? (
        <p className="py-4 text-center text-body-sm text-ink-secondary">No types match</p>
      ) : (
        <div role="grid" aria-label="Types" className="flex flex-col gap-3">
          {sections.map((section) => (
            <section
              key={section.id}
              role="group"
              aria-labelledby={`palette-section-${section.id}`}
              className="flex flex-col gap-2"
            >
              <h3
                id={`palette-section-${section.id}`}
                className="flex justify-between text-micro text-ink-muted uppercase"
              >
                {section.name}
                <span aria-label={`${String(section.types.length)} types`}>
                  {section.types.length}
                </span>
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {section.types.map((type) => {
                  const badge = number < 9 ? ++number : null;
                  return (
                    <div key={type.id} role="gridcell" className="contents">
                      <button
                        type="button"
                        draggable
                        ref={(el) => {
                          if (el === null) tiles.current.delete(type.id);
                          else tiles.current.set(type.id, el);
                        }}
                        tabIndex={type.id === focusId ? 0 : -1}
                        onFocus={() => {
                          setActive(type.id);
                        }}
                        onClick={() => {
                          addAtCentre(type.id);
                        }}
                        onKeyDown={(event) => {
                          onTileKey(event, type.id);
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(TYPE_MIME, type.id);
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                        className={cn(
                          'relative flex min-w-0 cursor-grab flex-col items-center gap-1.5 rounded-card border border-hairline bg-surface px-1 py-2.5 text-center transition-colors hover:border-border hover:shadow-rest active:cursor-grabbing',
                          focusRing,
                        )}
                      >
                        <TypeTile type={type.id} size={28} decorative />
                        <span className="w-full truncate text-caption font-medium text-ink">
                          {type.name}
                        </span>
                        {badge !== null && (
                          <kbd
                            aria-hidden
                            className="absolute top-1 right-1 rounded-segment bg-surface-2 px-1 font-mono text-code-sm text-ink-secondary"
                          >
                            {badge}
                          </kbd>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <button
        type="button"
        draggable
        aria-label="Note"
        onClick={() => {
          if (readOnly) return;
          addNoteAt(editor, centrePoint());
        }}
        onDragStart={(event) => {
          if (readOnly) return;
          event.dataTransfer.setData(NOTE_MIME, 'note');
          event.dataTransfer.effectAllowed = 'copy';
        }}
        className={cn(
          'flex w-full cursor-grab items-start justify-between rounded-card border border-hairline bg-surface p-3 text-left transition-colors hover:border-border hover:shadow-rest active:cursor-grabbing',
          focusRing,
        )}
      >
        <span className="flex flex-col">
          <span className="text-body font-medium text-ink">Note</span>
          <span className="text-caption text-ink-secondary">Markdown, 180 px</span>
        </span>
      </button>
      <p className="text-caption text-ink-secondary">
        Drag Note onto a node to pin it, or onto empty canvas for a free note. N adds one at the
        pointer.
      </p>
      <button
        type="button"
        onClick={() => {
          setPalette({ view: 'packs', search: '' });
        }}
        className={cn(
          'sticky bottom-0 flex w-full items-center gap-2 rounded-row border-t border-hairline bg-surface px-1 py-2.5 text-body-sm text-ink hover:text-primary-ink',
          focusRing,
        )}
      >
        <Package
          aria-hidden
          strokeWidth={ICON_STROKE_WIDTH}
          className="size-4 text-ink-secondary"
        />
        <span className="flex-1 text-left">Packs · {onPacksCount} on</span>
        <ChevronRight
          aria-hidden
          strokeWidth={ICON_STROKE_WIDTH}
          className="size-4 text-ink-secondary"
        />
      </button>
    </section>
  );
}
