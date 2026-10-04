import { Button } from '@sododeck/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Check,
  CircleAlert,
  Download,
  Loader,
  LoaderCircle,
  RotateCw,
  TriangleAlert,
} from 'lucide-react';

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

const ERROR_TEXT = "Couldn't save — export a backup";
const SAVING_TEXT = 'Saving…';
const SAVED_TEXT = 'Saved in this browser';

function ErrorDetails({
  firstUnsavedAt,
  errorName,
}: {
  firstUnsavedAt: number;
  errorName: string;
}) {
  const { flush } = useSaveControls();
  const exportDeck = useExportDeck();
  return (
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
  );
}

function ErrorStatus(props: { firstUnsavedAt: number; errorName: string }) {
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
          {ERROR_TEXT}
        </PopoverTrigger>
        <ErrorDetails {...props} />
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
 * The status as an icon (018, §g-51, design 86): a check, a loader (still under reduced motion)
 * or a clay alert, with the same words as its tooltip, accessible name and live-region text. The
 * shape differs per state, so it is never colour-only. The alert opens the error details.
 */
function IconStatus() {
  const status = useSaveStatusStore((s) => s.status);
  const iconClass = 'size-3.75';
  if (status.kind === 'error') {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger
              aria-label={ERROR_TEXT}
              className={cn(
                'flex size-7 cursor-pointer items-center justify-center rounded-row bg-clay-soft text-clay-ink',
                focusRing,
              )}
            >
              <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className={iconClass} />
              <span className="sr-only">{ERROR_TEXT}</span>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{ERROR_TEXT}</TooltipContent>
        </Tooltip>
        <ErrorDetails {...status} />
      </Popover>
    );
  }
  const text = status.kind === 'saving' ? SAVING_TEXT : SAVED_TEXT;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex size-7 items-center justify-center text-ink-secondary">
          {status.kind === 'saving' ? (
            <LoaderCircle
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className={cn(iconClass, 'motion-safe:animate-spin')}
            />
          ) : (
            <Check
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className={cn(iconClass, 'text-success-ink')}
            />
          )}
          <span className="sr-only">{text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The autosave status (FR-003–FR-005, design 83–85). A polite live region with an icon and text
 * for each state, so it is never color-only. `icon` is the deck island's compact form (018).
 */
export function SaveStatus({ variant = 'text' }: { variant?: 'text' | 'icon' }) {
  const { mode } = useSaveControls();
  const status = useSaveStatusStore((s) => s.status);

  if (mode === 'demo') {
    return (
      <span role="status" className="px-1 text-caption whitespace-nowrap text-ink-muted">
        Demo · not saved
      </span>
    );
  }
  if (variant === 'icon') {
    return (
      <div role="status" aria-live="polite" className="flex items-center">
        <IconStatus />
      </div>
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
          {SAVING_TEXT}
        </span>
      )}
      {/* A queued write looks saved until it has waited 1 s (051 US6): no spinner while typing. */}
      {(status.kind === 'saved' || status.kind === 'pending') && (
        <span className="flex items-center gap-1.5 text-ink-secondary">
          <Check aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 text-success-ink" />
          {SAVED_TEXT}
        </span>
      )}
      {status.kind === 'error' && <ErrorStatus {...status} />}
    </div>
  );
}
