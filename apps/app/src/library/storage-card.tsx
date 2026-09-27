import { Button } from '@sododeck/ui/components/button';
import { useToast } from '@sododeck/ui/components/toast';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleDashed, HardDrive, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  formatBytes,
  readStorageState,
  requestPersistence,
  STORAGE_WARNING_RATIO,
  type StorageState,
} from '../storage/storage-estimate';

const HELP: Record<StorageState['persisted'], string> = {
  on: "The browser won't clear your decks to free up space.",
  off: 'The browser may clear decks when disk space runs low.',
  declined: 'Browser declined. Try again after installing the app.',
  unsupported: 'Not persistent in this browser',
};

/**
 * The sidebar storage card (FR-030–FR-033, design 80 card and 81): usage as a meter and text,
 * and the persistent-storage state with an icon and a word (never color alone). `refreshKey`
 * re-reads the estimate after imports and deletes.
 */
export function StorageCard({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<StorageState | null>(null);
  // A refusal is remembered for the session: the browser itself only reports "not persisted".
  const [declined, setDeclined] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let live = true;
    void readStorageState().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [refreshKey]);

  if (state === null) return null;
  const { usage, quota } = state;
  const persisted = state.persisted === 'off' && declined ? 'declined' : state.persisted;
  const ratio = usage !== undefined && quota ? usage / quota : null;
  const on = persisted === 'on';

  return (
    <section
      aria-label="Browser storage"
      className="flex flex-col gap-2.5 rounded-card bg-surface-2 p-3 text-body-sm"
    >
      <p className="flex items-center gap-1.5 text-body font-medium">
        <HardDrive aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Persistent storage</span>
        <span className="sr-only"> · </span>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-caption font-medium',
            on ? 'bg-success-soft text-success-ink' : 'bg-surface text-ink-secondary',
          )}
        >
          {on ? (
            <ShieldCheck aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          ) : (
            <CircleDashed aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          )}
          {on ? 'On' : 'Off'}
        </span>
      </p>
      {ratio !== null && usage !== undefined && quota !== undefined && (
        <>
          <div
            role="meter"
            aria-label="Storage used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuetext={`${formatBytes(usage)} of ${formatBytes(quota)} used`}
            className="h-1 overflow-hidden rounded-full bg-surface-3"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${String(Math.max(2, Math.min(100, ratio * 100)))}%` }}
            />
          </div>
          <p className="text-ink-secondary">
            {formatBytes(usage)} of {formatBytes(quota)} used
          </p>
        </>
      )}
      {ratio !== null && ratio > STORAGE_WARNING_RATIO && (
        <p className="flex items-start gap-1.5 text-clay-ink">
          <TriangleAlert
            aria-hidden
            strokeWidth={ICON_STROKE_WIDTH}
            className="mt-0.5 size-3.5 shrink-0"
          />
          Storage is almost full. Export decks you want to keep.
        </p>
      )}
      <p className="text-ink-secondary">{HELP[persisted]}</p>
      {(persisted === 'off' || persisted === 'declined') && (
        <Button
          size="sm"
          className="w-full bg-surface"
          onClick={() => {
            void requestPersistence().then((next) => {
              setDeclined(next.persisted === 'declined');
              setState(next.persisted === 'declined' ? { ...next, persisted: 'off' } : next);
              if (next.persisted === 'on') toast({ message: 'Persistent storage is on' });
            });
          }}
        >
          <ShieldCheck />
          Request persistent storage
        </Button>
      )}
    </section>
  );
}
