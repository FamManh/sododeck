import {
  CATEGORIES,
  deckPacks,
  isKnownPack,
  PACKS,
  STICKY_DEFAULT_SIZE,
  typesOfPacks,
  type CardType,
  type PackTool,
} from '@sododeck/model';
import { SearchField } from '@sododeck/ui/components/search-field';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow } from '@xyflow/react';
import { ChevronRight, FileCode2, Frame, List, Package } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { NodeTypeTile } from './shapes/shape-tile';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { PALETTE_INITIAL, useUiStore } from '../state/ui-store';
import { addComponent, addTable, canvasElement, centredOn, PALETTE_ID } from './canvas-actions';
import { groupableCount, groupFromSelection } from './editing/group-from-selection';
import { armFrameTool, placeFrameAtCentre } from './frame-tool/frame-actions';
import { neighbour } from './grid-nav';
import { addEnumAndOpen } from './inspector/enum/add-enum-and-open';
import { PacksPanel } from './packs-panel';
import { addNoteAt, notesAreReadOnly } from './stickies/sticky-actions';
import { StickyPad } from './stickies/sticky-pad';
import { NOTE_MIME, TYPE_MIME } from './use-canvas-handlers';

const COLUMNS = 3;
/** The search field of the flyout, found by `/` (see `use-shell-shortcuts`). */
export const PALETTE_SEARCH_ID = 'palette-search';

interface Section {
  id: string;
  name: string;
  types: readonly CardType[];
  /** Tool tiles after the types (031: Sticky, Frame), listed when their pack is on. */
  tools: readonly PackTool[];
}

/** Tool tiles' ids in the roving focus; never type ids, so keys 1–9 never add one. */
const toolTileId = (tool: PackTool) => `tool:${tool}`;
const TOOL_NAMES: Record<PackTool, string> = { sticky: 'Sticky', frame: 'Frame', enum: 'Enum' };

/** The Database section names its tools after what they make (043 R13, frame 168). */
const DATABASE_TOOL_NAMES: Record<PackTool, string> = {
  sticky: 'Note',
  frame: 'Table group',
  enum: 'Enum',
};

/** Letter keys shown on the Database tiles (frame 168): T, S and G. */
const DATABASE_KEYS: Readonly<Record<string, string>> = {
  'db-table': 'T',
  sticky: 'S',
  frame: 'G',
};

const toolName = (section: string, tool: PackTool) =>
  section === 'database' ? DATABASE_TOOL_NAMES[tool] : TOOL_NAMES[tool];

const tileIds = (section: Section): string[] => [
  ...section.types.map((t) => t.id),
  ...section.tools.map(toolTileId),
];

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
  const stickyColour = useUiStore((s) => s.lastStickyColour);
  const { search, tab, view } = useUiStore((s) => s.addFlyout);
  const setPalette = useUiStore((s) => s.setPalette);
  const [active, setActive] = useState<string | null>(null);
  const frameToolOn = useUiStore((s) => s.tool === 'frame');
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
        .map((c) => {
          // A pack with tool tiles (031's Basic shapes) names its section after the pack.
          const pack = PACKS.find((p) => p.id === c.id && p.tools !== undefined);
          const matches = (name: string) => query === '' || name.toLowerCase().includes(query);
          return {
            id: c.id,
            name: pack?.name ?? c.name,
            types: onTypes.filter((t) => t.category === c.id && matches(t.name)),
            tools: (pack?.tools ?? []).filter((tool) => matches(toolName(c.id, tool))),
          };
        })
        .filter((s) => s.types.length > 0 || s.tools.length > 0),
    [tabs, onTypes, shownTab, query],
  );
  const visible = useMemo(() => sections.flatMap((s) => s.types.map((t) => t.id)), [sections]);
  const focusable = useMemo(() => sections.flatMap(tileIds), [sections]);

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
    if (active === null || focusable.includes(active)) return;
    const stray = document.activeElement;
    if (stray !== null && stray !== document.body) return;
    const next = focusable[0];
    if (next !== undefined) tiles.current.get(next)?.focus();
  }, [active, focusable]);

  const centrePoint = () => {
    const rect = canvasElement()?.getBoundingClientRect();
    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    });
  };
  const addAtCentre = (type: string) => {
    // A table starts with an `id` key column (043 R12).
    if (type === 'db-table') addTable(editor, centrePoint());
    else addComponent(editor, type, centredOn(centrePoint(), type), { edit: true });
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
    const next = neighbour(sections.map(tileIds), id, event.key, COLUMNS);
    event.preventDefault();
    if (next === null) return;
    setActive(next);
    tiles.current.get(next)?.focus();
  };
  const focusId = active !== null && focusable.includes(active) ? active : (focusable[0] ?? null);
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
                <span aria-label={`${String(section.types.length + section.tools.length)} types`}>
                  {section.types.length + section.tools.length}
                </span>
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {section.types.map((type) => {
                  const counted = number < 9 ? ++number : null;
                  const badge =
                    section.id === 'database' ? (DATABASE_KEYS[type.id] ?? counted) : counted;
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
                        <NodeTypeTile type={type.id} size={28} decorative />
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
                {section.tools.map((tool) => {
                  const tileId = toolTileId(tool);
                  const Icon = tool === 'enum' ? List : Frame;
                  const name = toolName(section.id, tool);
                  const letter = section.id === 'database' ? DATABASE_KEYS[tool] : undefined;
                  const button = (
                    <button
                      type="button"
                      draggable={tool === 'sticky'}
                      aria-label={name}
                      aria-disabled={tool === 'sticky' && readOnly ? true : undefined}
                      {...(tool === 'frame' && frameToolOn ? { 'aria-pressed': true } : {})}
                      ref={(el) => {
                        if (el === null) tiles.current.delete(tileId);
                        else tiles.current.set(tileId, el);
                      }}
                      tabIndex={tileId === focusId ? 0 : -1}
                      onFocus={() => {
                        setActive(tileId);
                      }}
                      onClick={(event) => {
                        if (tool === 'sticky') {
                          if (!readOnly) addNoteAt(editor, centrePoint());
                          return;
                        }
                        // An enum has no place on the canvas: it opens its drawer (052).
                        if (tool === 'enum') {
                          addEnumAndOpen(editor, deck);
                          return;
                        }
                        // Table group (043 R13): groups the selection, else a frame at the centre.
                        if (section.id === 'database') {
                          const { selection } = useUiStore.getState();
                          if (groupableCount(selection) >= 2) groupFromSelection(editor, selection);
                          else placeFrameAtCentre(editor, centrePoint());
                          return;
                        }
                        // ⏎ / Space place a default frame at the view centre (US2 AS8); a
                        // pointer click arms the tool so the next drag draws one.
                        if (event.detail === 0) placeFrameAtCentre(editor, centrePoint());
                        else armFrameTool();
                      }}
                      onKeyDown={(event) => {
                        onTileKey(event, tileId);
                      }}
                      onDragStart={(event) => {
                        if (tool !== 'sticky' || readOnly) return;
                        event.dataTransfer.setData(NOTE_MIME, 'note');
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      className={cn(
                        'relative flex w-full min-w-0 flex-col items-center gap-1.5 rounded-card border border-hairline bg-surface px-1 py-2.5 text-center transition-colors hover:border-border hover:shadow-rest',
                        tool === 'sticky' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                        tool === 'frame' && frameToolOn && 'border-primary bg-primary-soft',
                        focusRing,
                      )}
                    >
                      {tool === 'sticky' ? (
                        <StickyPad color={stickyColour} />
                      ) : (
                        <span
                          aria-hidden
                          className="inline-flex size-7 items-center justify-center rounded-[8px] bg-surface-2 text-ink-secondary"
                        >
                          <Icon size={18} strokeWidth={ICON_STROKE_WIDTH} />
                        </span>
                      )}
                      <span className="w-full truncate text-caption font-medium text-ink">
                        {name}
                      </span>
                      {letter !== undefined && (
                        <kbd
                          aria-hidden
                          className="absolute top-1 right-1 rounded-segment bg-surface-2 px-1 font-mono text-code-sm text-ink-secondary"
                        >
                          {letter}
                        </kbd>
                      )}
                    </button>
                  );
                  return (
                    <div key={tileId} role="gridcell" className="contents">
                      {tool === 'frame' && section.id !== 'database' ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{button}</TooltipTrigger>
                          <TooltipContent>Draw a group frame</TooltipContent>
                        </Tooltip>
                      ) : (
                        button
                      )}
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
          <span className="text-caption text-ink-secondary">
            Markdown, {STICKY_DEFAULT_SIZE.width} px
          </span>
        </span>
        <StickyPad color={stickyColour} />
      </button>
      <p className="text-caption text-ink-secondary">
        Drag Note onto the canvas for a free note; pin it from its toolbar. N adds one at the
        pointer.
      </p>
      {packs.includes('database') && (
        <button
          type="button"
          onClick={(event) => {
            useUiStore.getState().openImport(event.currentTarget);
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded-row border-t border-hairline px-1 py-2.5 text-body-sm text-ink hover:text-primary-ink',
            focusRing,
          )}
        >
          <FileCode2
            aria-hidden
            strokeWidth={ICON_STROKE_WIDTH}
            className="size-4 text-ink-secondary"
          />
          <span className="flex-1 text-left">Import SQL or DBML…</span>
        </button>
      )}
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
