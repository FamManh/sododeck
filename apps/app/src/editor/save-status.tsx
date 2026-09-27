import { Button } from '@sododeck/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Check, Download, Loader, RotateCw, TriangleAlert } from 'lucide-react';

import { isApplePlatform } from '../lib/features';
import { useSaveStatusStore } from '../storage/save-status';
import { useSaveControls } from './save-context';
import { useExportDeck } from './use-export-deck';

const time = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' });

function errorHelp(errorName: string): string {
  if (errorName === 'QuotaExceededError') {
    return "This browser's storage is full. Your edits are safe in this tab until you close it.";
  }
  if (errorName === 'StorageUnavailable') {
    return 'This browser does not let Sododeck keep decks. Your edits are safe in this tab until you close it.';
  }
  return 'Your edits are safe in this tab until you close it.';
}

function ErrorStatus({ firstUnsavedAt, errorName }: { firstUnsavedAt: number; errorName: string }) {
  const { flush } = useSaveControls();
  const exportDeck = useExportDeck();
  return (
    <span className="flex items-center gap-1 rounded-full bg-clay-soft py-0.5 pr-0.5 pl-1 text-clay-ink">
      <Popover>
        <PopoverTrigger
          className={cn(
            'flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2 text-body-sm font-medium',
            focusRing,
          )}
        >
          <TriangleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
          {"Couldn't save — export a backup"}
        </PopoverTrigger>
        <PopoverContent aria-label="Couldn't save your last change" align="end" className="w-96">
          <div className="flex gap-2.5">
            <TriangleAlert
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="mt-0.5 size-4.5 shrink-0 text-clay-ink"
            />
            <div className="flex flex-col gap-1">
              <p className="text-title-sm">{"Couldn't save your last change"}</p>
              <p className="text-body text-ink-secondary">{errorHelp(errorName)}</p>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-row bg-surface-2 px-3 py-2 text-body-sm">
            <dt className="text-ink-secondary">Unsaved since</dt>
            <dd className="text-right tabular-nums">{time.format(firstUnsavedAt)}</dd>
            <dt className="text-ink-secondary">Error</dt>
            <dd className="text-right font-mono">{errorName}</dd>
          </dl>
          <div className="flex gap-2">
            <Button variant="primary" onClick={exportDeck}>
              <Download />
              Export .sododeck.json
            </Button>
            <Button
              onClick={() => {
                void flush();
              }}
            >
              <RotateCw />
              Retry
              <kbd aria-hidden className="font-sans text-caption text-ink-secondary">
                {isApplePlatform() ? '⌘S' : 'Ctrl+S'}
              </kbd>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        size="sm"
        className="h-7 rounded-full border-transparent bg-clay-ink text-clay-soft hover:bg-clay-ink"
        onClick={exportDeck}
      >
        <Download />
        Export
      </Button>
    </span>
  );
}

/**
 * The autosave status in the top bar (FR-003–FR-005, design 83–85). A polite live region with an
 * icon and text for each state, so it is never color-only.
 */
export function SaveStatus() {
  const { mode } = useSaveControls();
  const status = useSaveStatusStore((s) => s.status);

  if (mode === 'demo') {
    return (
      <span role="status" className="text-caption text-ink-muted">
        Demo · not saved
      </span>
    );
  }
  return (
    <div role="status" aria-live="polite" className="flex items-center text-body-sm">
      {status.kind === 'saving' && (
        <span className="flex items-center gap-1.5 text-ink-secondary">
          <Loader
            aria-hidden
            strokeWidth={ICON_STROKE_WIDTH}
            className="size-4 motion-safe:animate-spin"
          />
          Saving…
        </span>
      )}
      {status.kind === 'saved' && (
        <span className="flex items-center gap-1.5 text-ink-secondary">
          <Check aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 text-success-ink" />
          Saved in this browser
        </span>
      )}
      {status.kind === 'error' && <ErrorStatus {...status} />}
    </div>
  );
}
