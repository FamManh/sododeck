import { stickyCanvasPosition } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { ChevronRight, StickyNote } from 'lucide-react';
import { useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';

import { useUiStore } from '../state/ui-store';
import { buildNotesOutline, type NoteOutlineItem } from './outline';

const NOTES_SECTION_ID = 'notes-outline';

export function NotesOutline({
  deck,
  notes = deck.stickies,
}: {
  deck: SododeckFile;
  notes?: readonly SododeckFile['stickies'][number][];
}) {
  const collapsed = useUiStore((state) => state.outlineCollapsed.has(NOTES_SECTION_ID));
  const toggle = useUiStore((state) => state.toggleOutlineGroup);
  const { getZoom, setCenter } = useReactFlow();
  const rows = useMemo<NoteOutlineItem[]>(
    () => buildNotesOutline({ ...deck, stickies: [...notes] }),
    [deck, notes],
  );

  if (rows.length === 0) return null;

  return (
    <PanelSection>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={collapsed ? 'false' : 'true'}
          onClick={() => {
            toggle(NOTES_SECTION_ID);
          }}
          className={cn(
            '-mx-2 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-row px-2 py-1 text-left text-body-sm font-medium text-ink hover:bg-surface-2',
            focusRing,
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn('size-4 shrink-0 transition-transform', !collapsed && 'rotate-90')}
          />
          <span>Notes</span>
        </button>
        <h3 className="text-micro text-ink-muted uppercase">{`Notes · ${String(rows.length)}`}</h3>
      </div>
      {!collapsed && (
        <ul role="list" aria-label="Notes" className="-mx-2 flex flex-col">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  const sticky = deck.stickies.find((entry) => entry.id === row.id);
                  if (sticky === undefined) return;
                  const point = stickyCanvasPosition(deck, sticky).point;
                  useUiStore.getState().select({ stickies: [row.id] });
                  void setCenter(point.x, point.y, { zoom: getZoom() });
                }}
                className={cn(
                  'flex h-8 w-full cursor-pointer items-center gap-2 rounded-row px-2 text-left text-body-sm text-ink hover:bg-surface-2',
                  focusRing,
                )}
              >
                <StickyNote aria-hidden className="size-4 shrink-0 text-ink-secondary" />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
