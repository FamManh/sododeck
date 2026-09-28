import type { Id, View } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { InlineEdit } from '@sododeck/ui/components/inline-edit';
import { Popover, PopoverAnchor } from '@sododeck/ui/components/popover';
import { useToast } from '@sododeck/ui/components/toast';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { supportsResizeObserver } from '../../lib/features';
import { readDeck, useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { DeleteViewDialog } from './delete-view-dialog';
import { selectView, useViewState } from './use-current-view';
import { ViewSettingsPopover } from './view-settings-popover';
import type { TidyAction } from './tidy-layout-item';
import { ViewTabMenu } from './view-tab-menu';
import { viewTabName } from './view-title';
import { TAB_ESTIMATE, visibleTabs } from './visible-tabs';

/** Inline rename field (FR-041): Enter commits, Esc cancels, a blank name is refused. */
function RenameField({ view, onDone }: { view: View; onDone: () => void }) {
  const editor = useEditor();
  const [blank, setBlank] = useState(false);
  const hintId = useId();
  return (
    <span className="relative flex">
      <InlineEdit
        label="View name"
        value={view.title}
        autoFocus
        aria-invalid={blank || undefined}
        aria-describedby={blank ? hintId : undefined}
        className="h-8 w-32 bg-surface text-body-sm text-ink"
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        onCommit={(next) => {
          const title = next.trim();
          if (title !== '' && title !== view.title) editor.updateView(view.id, { title });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (event.currentTarget.value.trim() === '') {
              event.preventDefault();
              setBlank(true);
              useUiStore.getState().announce('A view needs a name');
              return;
            }
            onDone();
          }
          if (event.key === 'Escape') onDone();
        }}
        onInput={() => {
          setBlank(false);
        }}
        onBlur={onDone}
      />
      {blank && (
        <span
          id={hintId}
          className="absolute top-full left-0 z-20 mt-1 w-max rounded-row border border-clay-ink bg-surface px-2 py-1 text-caption text-clay-ink shadow-hover"
        >
          A view needs a name
        </span>
      )}
    </span>
  );
}

/**
 * The view switcher (design 02/20–22, FR-002, FR-040–FR-043): a segmented tab list in the top
 * bar's centre, the current view raised, then "+" (Add view). Roving tabindex: ←/→ move focus,
 * Home/End jump, Enter/Space select. Each tab has a menu (⋯, right-click, Shift+F10): Rename,
 * View settings…, Delete view. The canvas fits the new view itself (it watches the current view).
 */
export function ViewSwitcher({
  tidy,
  compact = false,
}: {
  /** Tidy layout in the current view's menu (018 §g-46). */
  tidy?: TidyAction;
  /** Narrow windows (018 FR-041): the views become one dropdown. */
  compact?: boolean;
} = {}) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const { views, view: current } = useViewState();
  const { toast } = useToast();
  const [focusedId, setFocusedId] = useState<Id | null>(null);
  const [menuFor, setMenuFor] = useState<Id | null>(null);
  const [renaming, setRenaming] = useState<Id | null>(null);
  const [settingsFor, setSettingsFor] = useState<Id | null>(null);
  const [deleting, setDeleting] = useState<View | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<Id, HTMLButtonElement>());
  const openedFromMenu = useRef(false);
  const wrappers = useRef(new Map<Id, HTMLDivElement>());
  const [widths, setWidths] = useState<ReadonlyMap<Id, number>>(() => new Map());

  // Overflow (edge case "Many views"): measure the centre slot and each shown tab (hidden tabs
  // keep their last width); without ResizeObserver every tab is shown and the list scrolls.
  const tablistRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const slot = rootRef.current?.parentElement;
    const list = tablistRef.current;
    if (!supportsResizeObserver() || slot == null || list === null) return;
    const observer = new ResizeObserver(() => {
      setAvailable(slot.clientWidth);
      setWidths((previous) => {
        let changed = false;
        const next = new Map(previous);
        for (const [id, element] of wrappers.current) {
          const width = element.offsetWidth;
          if (width > 0 && next.get(id) !== width) {
            next.set(id, width);
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    });
    observer.observe(slot);
    observer.observe(list);
    return () => {
      observer.disconnect();
    };
  }, []);

  const { shown, overflow } = visibleTabs(
    views,
    current.id,
    available,
    (id) => widths.get(id) ?? TAB_ESTIMATE,
  );
  const stopId = shown.some((v) => v.id === focusedId) ? focusedId : current.id;

  const focusTab = (id: Id | undefined) => {
    if (id === undefined) return;
    setFocusedId(id);
    // After a rename or dialog the tab may render again first.
    requestAnimationFrame(() => tabRefs.current.get(id)?.focus());
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, view: View, index: number) => {
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault();
      setMenuFor(view.id);
      return;
    }
    const last = shown.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target !== null) {
      event.preventDefault();
      const id = shown[target]?.id;
      setFocusedId(id ?? null);
      if (id !== undefined) tabRefs.current.get(id)?.focus();
    }
  };

  const addView = () => {
    const id = editor.addView();
    const title = readDeck(editor.doc).views.find((v) => v.id === id)?.title ?? 'Custom view';
    selectView({ id, title });
    toast({ message: `View "${title}" created` });
    focusTab(id);
  };

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`View: ${current.title}`}
            aria-haspopup="menu"
            className="max-w-40 min-w-0 bg-surface-2 px-2.5"
          >
            <span className="truncate">{current.title}</span>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label="Views" aria-labelledby={undefined} align="start">
          {views.map((view) => (
            <DropdownMenuItem
              key={view.id}
              aria-current={view.id === current.id ? 'true' : undefined}
              onSelect={() => {
                if (view.id !== current.id) selectView(view);
              }}
            >
              {view.title}
            </DropdownMenuItem>
          ))}
          {tidy !== undefined && (
            <DropdownMenuItem disabled={tidy.block !== null || tidy.running} onSelect={tidy.run}>
              Tidy layout
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={addView}>Add view</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex max-w-full min-w-0 items-center gap-0.5 rounded-input bg-surface-2 p-0.5"
    >
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Views"
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto"
      >
        {shown.map((view, index) => {
          const selected = view.id === current.id;
          return (
            <Popover
              key={view.id}
              open={settingsFor === view.id}
              onOpenChange={(open) => {
                if (!open) setSettingsFor(null);
              }}
            >
              <PopoverAnchor asChild>
                <div
                  role="none"
                  ref={(element) => {
                    if (element) wrappers.current.set(view.id, element);
                    else wrappers.current.delete(view.id);
                  }}
                  className={cn(
                    'group/tab flex shrink-0 items-center rounded-segment pr-1',
                    selected && 'bg-surface shadow-rest',
                  )}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenuFor(view.id);
                  }}
                >
                  {renaming === view.id ? (
                    <RenameField
                      view={view}
                      onDone={() => {
                        setRenaming(null);
                        focusTab(view.id);
                      }}
                    />
                  ) : (
                    <button
                      ref={(element) => {
                        if (element) tabRefs.current.set(view.id, element);
                        else tabRefs.current.delete(view.id);
                      }}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-label={viewTabName(view)}
                      title={`${view.title} · ${view.type} view`}
                      tabIndex={view.id === stopId ? 0 : -1}
                      onFocus={() => {
                        setFocusedId(view.id);
                      }}
                      onClick={() => {
                        if (!selected) selectView(view);
                      }}
                      onDoubleClick={() => {
                        setRenaming(view.id);
                      }}
                      onKeyDown={(event) => {
                        onTabKeyDown(event, view, index);
                      }}
                      className={cn(
                        'h-8 max-w-40 cursor-pointer truncate rounded-segment pr-1 pl-3 text-body-sm text-ink-secondary transition-colors hover:text-ink',
                        selected && 'font-medium text-ink',
                        focusRing,
                      )}
                    >
                      {view.title}
                    </button>
                  )}
                  <ViewTabMenu
                    title={view.title}
                    canDelete={views.length > 1}
                    {...(selected && tidy !== undefined ? { tidy } : {})}
                    open={menuFor === view.id}
                    onOpenChange={(open) => {
                      setMenuFor(open ? view.id : null);
                    }}
                    onCloseFocus={() => {
                      // Rename, settings and delete take focus themselves.
                      if (openedFromMenu.current) openedFromMenu.current = false;
                      else tabRefs.current.get(view.id)?.focus();
                    }}
                    onRename={() => {
                      openedFromMenu.current = true;
                      setMenuFor(null);
                      setRenaming(view.id);
                    }}
                    onSettings={() => {
                      openedFromMenu.current = true;
                      setMenuFor(null);
                      setSettingsFor(view.id);
                    }}
                    onDelete={() => {
                      openedFromMenu.current = true;
                      setMenuFor(null);
                      setDeleting(view);
                    }}
                  />
                </div>
              </PopoverAnchor>
              {settingsFor === view.id && (
                <ViewSettingsPopover
                  deck={deck}
                  view={view}
                  onCloseFocus={() => {
                    focusTab(view.id);
                  }}
                />
              )}
            </Popover>
          );
        })}
      </div>
      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="More views" className="px-2">
              {`+${String(overflow.length)}`}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent aria-label="More views" aria-labelledby={undefined} align="end">
            {overflow.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onSelect={() => {
                  selectView(view);
                  focusTab(view.id);
                }}
              >
                {view.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Add view"
        title="Add view"
        onClick={addView}
      >
        <Plus />
      </Button>
      {deleting !== null && (
        <DeleteViewDialog
          view={deleting}
          onClose={(deleted) => {
            const id = deleting.id;
            setDeleting(null);
            if (!deleted) focusTab(id);
            else
              requestAnimationFrame(() => {
                rootRef.current
                  ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
                  ?.focus();
              });
          }}
        />
      )}
    </div>
  );
}
