import { isLegacyLayout, type DeckDoc } from '@sododeck/model';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData } from 'react-router';

import { DeckDeletedDialog } from '../editor/deck-deleted-dialog';
import { EditorShell } from '../editor/editor-shell';
import { openDeck, type DeckSource } from '../editor/open-deck';
import { type SaveControls } from '../editor/save-context';
import { dbPictureStore, memoryPictureStore } from '../images/picture-store';
import { readDeck } from '../model/use-deck-snapshot';
import { sweepBlobs } from '../storage/blob-gc';
import { attachDeckChannel } from '../storage/deck-channel';
import { attachDeckPersistence, type DeckPersistence } from '../storage/deck-persistence';
import { markExported, markOpened } from '../storage/library-db';
import { isOwnUpdate } from '../storage/origins';
import { useSaveStatusStore } from '../storage/save-status';
import type { DeckLoaderData } from './deck-loader';
import { DeckNotFoundPage } from './deck-not-found-page';
import { useWebDeckServices } from './web-deck-services';

/** Loader data of a deck the editor can open. */
type OpenDeckData = Exclude<DeckLoaderData, { kind: 'not-found' }>;

/** Attaches storage to a stored deck and exposes flush/export bookkeeping to the editor. */
function useSaveControlsFor(data: OpenDeckData, doc: DeckDoc) {
  const persistenceRef = useRef<DeckPersistence | null>(null);

  // A layout effect: it must run before the shell's own effects (fitting frames), which are
  // children's passive effects, so those writes are saved.
  useLayoutEffect(() => {
    if (data.kind === 'memory') {
      // Storage is unavailable (research R15): the first edit shows the error state.
      const onUpdate = (_: Uint8Array, origin: unknown) => {
        if (!isOwnUpdate(origin)) return;
        useSaveStatusStore.getState().dispatch({
          type: 'failed',
          firstUnsavedAt: Date.now(),
          errorName: 'StorageUnavailable',
        });
      };
      doc.on('update', onUpdate);
      return () => {
        doc.off('update', onUpdate);
      };
    }
    if (data.kind !== 'stored') return;
    const persistence = attachDeckPersistence(data.db, data.deckId, doc, {
      onStatus: (event) => {
        useSaveStatusStore.getState().dispatch(event);
      },
    });
    persistenceRef.current = persistence;
    const channel = attachDeckChannel(data.deckId, doc, { persistence });
    void markOpened(data.db, data.deckId).catch(() => undefined);
    return () => {
      persistenceRef.current = null;
      channel.destroy();
      persistence.destroy();
    };
  }, [data, doc]);

  return useMemo<SaveControls>(
    () => ({
      mode: data.kind === 'stored' ? 'stored' : data.kind,
      flush: () => persistenceRef.current?.flush() ?? Promise.resolve(),
      markExported: () => {
        if (data.kind === 'stored') void markExported(data.db, data.deckId).catch(() => undefined);
      },
    }),
    [data],
  );
}

/** The web editor: the shared shell with the library's storage, pictures and services around it. */
function WebEditor({ data, doc }: { data: OpenDeckData; doc: DeckDoc }) {
  const save = useSaveControlsFor(data, doc);
  const services = useWebDeckServices();
  const pictures = useMemo(
    () => (data.kind === 'stored' ? dbPictureStore(data.db, data.deckId) : memoryPictureStore()),
    [data],
  );
  // Once per open: pictures no image uses any more (an add that was undone last session) go away.
  useEffect(() => {
    if (data.kind !== 'stored') return;
    const used = (readDeck(doc).images ?? []).map((image) => image.asset);
    void sweepBlobs(data.db, data.deckId, used).catch(() => undefined);
  }, [data, doc]);

  return (
    <EditorShell
      doc={doc}
      save={save}
      pictures={pictures}
      services={services}
      deckKey={data.kind === 'stored' ? data.deckId : null}
      extras={
        data.kind === 'stored' ? (
          <DeckDeletedDialog db={data.db} deckId={data.deckId} doc={doc} />
        ) : null
      }
    />
  );
}

/** The editor route: storage attaches to the deck's document as a provider (the web app). */
export function EditorPage() {
  const data = useLoaderData<DeckLoaderData>();
  if (data.kind === 'not-found') return <DeckNotFoundPage />;
  return <DeckGate key={data.kind === 'stored' ? data.deckId : data.kind} data={data} />;
}

/**
 * Builds the deck's document once (stored bytes are decoded here and nowhere else) and refuses a
 * deck stored by a build before 036, which would otherwise read as empty (036 FR-027).
 */
function DeckGate({ data }: { data: OpenDeckData }) {
  const [doc] = useState(() => {
    const source: DeckSource =
      data.kind === 'stored' ? { kind: 'stored', bytes: data.bytes } : { kind: data.kind };
    return openDeck(source);
  });
  if (data.kind === 'stored' && isLegacyLayout(doc)) {
    return <DeckNotFoundPage reason="unsupported" />;
  }
  return <WebEditor data={data} doc={doc} />;
}
