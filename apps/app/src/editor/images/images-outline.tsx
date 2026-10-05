import { imageBox } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow } from '@xyflow/react';
import { ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useMemo } from 'react';

import { useUiStore } from '../../state/ui-store';
import { buildImagesOutline, type NoteOutlineItem } from '../outline';

const IMAGES_SECTION_ID = 'images-outline';

/** The deck's pictures as a list under Components and Notes (055): click selects and centres. */
export function ImagesOutline({ deck }: { deck: SododeckFile }) {
  const collapsed = useUiStore((state) => state.outlineCollapsed.has(IMAGES_SECTION_ID));
  const toggle = useUiStore((state) => state.toggleOutlineGroup);
  const { getZoom, setCenter } = useReactFlow();
  const rows = useMemo<NoteOutlineItem[]>(() => buildImagesOutline(deck), [deck]);

  if (rows.length === 0) return null;

  return (
    <PanelSection>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={collapsed ? 'false' : 'true'}
          onClick={() => {
            toggle(IMAGES_SECTION_ID);
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
          <span>Images</span>
        </button>
        <h3 className="text-micro text-ink-muted uppercase">{`Images · ${String(rows.length)}`}</h3>
      </div>
      {!collapsed && (
        <ul role="list" aria-label="Images" className="-mx-2 flex flex-col">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  const image = deck.images?.find((entry) => entry.id === row.id);
                  if (image === undefined) return;
                  const box = imageBox(image);
                  useUiStore.getState().select({ images: [row.id] });
                  void setCenter(box.x + box.width / 2, box.y + box.height / 2, {
                    zoom: getZoom(),
                  });
                }}
                className={cn(
                  'flex h-8 w-full cursor-pointer items-center gap-2 rounded-row px-2 text-left text-body-sm text-ink hover:bg-surface-2',
                  focusRing,
                )}
              >
                <ImageIcon aria-hidden className="size-4 shrink-0 text-ink-secondary" />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
