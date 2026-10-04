/**
 * The dialog's preview line (044 T019, FR-003): 300 ms after the text or an option changes, the
 * client previews the import (counts, detected dialect, conversions, first error). A newer
 * request cancels the older one; closing the dialog cancels it too (FR-006). Nothing is written.
 */
import { useEffect, useState } from 'react';

import { ImportCancelled, type ImportClient } from '../../db/import/import-client';
import type { ImportPreview, ImportSource, ImportTarget } from '../../db/import/types';

export const PREVIEW_DEBOUNCE_MS = 300;

export const LOAD_FAILED =
  'The import reader could not load. Try again when the app has finished installing.';

export type PreviewState =
  | { status: 'empty' }
  | { status: 'reading' }
  | { status: 'ready'; preview: ImportPreview }
  | { status: 'failed'; message: string };

export function useImportPreview(
  client: ImportClient,
  source: ImportSource,
  target: ImportTarget,
): PreviewState {
  // One key for everything the preview depends on; a result counts only for its own key.
  const key = JSON.stringify([source, target]);
  const empty = source.text.trim() === '';
  const [result, setResult] = useState<{ key: string; state: PreviewState } | null>(null);

  useEffect(() => {
    if (empty) return;
    let live = true;
    const timer = window.setTimeout(() => {
      client.cancel();
      client.preview(source, target).then(
        (preview) => {
          if (live) setResult({ key, state: { status: 'ready', preview } });
        },
        (error: unknown) => {
          if (!live || error instanceof ImportCancelled) return;
          setResult({ key, state: { status: 'failed', message: LOAD_FAILED } });
        },
      );
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // `key` stands for `source` and `target`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key, empty]);

  useEffect(
    () => () => {
      client.cancel();
    },
    [client],
  );
  if (empty) return { status: 'empty' };
  return result?.key === key ? result.state : { status: 'reading' };
}
