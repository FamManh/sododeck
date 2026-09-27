import type { DeckDoc } from '@sododeck/model';
import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData } from 'react-router';

import { Announcer } from '../editor/announcer';
import { Canvas } from '../editor/canvas';
import { ConfirmDeleteDialog } from '../editor/confirm-delete-dialog';
import { Inspector } from '../editor/inspector';
import { JsonPanel } from '../editor/json-panel';
import { LeftSidebar } from '../editor/left-sidebar';
import { openDeck, type DeckSource } from '../editor/open-deck';
import { SaveContext, type SaveControls } from '../editor/save-context';
import { TopBar } from '../editor/top-bar';
import { useEditorShortcuts } from '../editor/use-canvas-shortcuts';
import { EditorProvider } from '../model/editor-context';
import { useEditor } from '../model/use-editor';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { attachDeckPersistence, type DeckPersistence } from '../storage/deck-persistence';
import { markExported, markOpened } from '../storage/library-db';
import { isOwnUpdate } from '../storage/origins';
import { useSaveStatusStore } from '../storage/save-status';
import type { DeckLoaderData } from './deck-loader';
import { DeckNotFoundPage } from './deck-not-found-page';

function EditorLayout() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  useEditorShortcuts();

  return (
    <div className="grid h-dvh grid-rows-[56px_minmax(0,1fr)] bg-app">
      <TopBar deckName={deck.name ?? 'Untitled deck'} />
      <div className="grid min-h-0 grid-cols-[264px_minmax(0,1fr)_336px] gap-px bg-hairline">
        <LeftSidebar deck={deck} />
        <main className="flex min-h-0 flex-col bg-canvas">
          <div className="min-h-0 flex-1">
            <Canvas />
          </div>
          <JsonPanel />
        </main>
        <Inspector deck={deck} />
      </div>
      <ConfirmDeleteDialog deck={deck} />
      <Announcer />
    </div>
  );
}

/** Attaches storage to a stored deck and exposes flush/export bookkeeping to the editor. */
function useSaveControlsFor(data: Exclude<DeckLoaderData, { kind: 'not-found' }>, doc: DeckDoc) {
  const persistenceRef = useRef<DeckPersistence | null>(null);

  useEffect(() => {
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
    void markOpened(data.db, data.deckId).catch(() => undefined);
    return () => {
      persistenceRef.current = null;
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

function EditorShell({ data }: { data: Exclude<DeckLoaderData, { kind: 'not-found' }> }) {
  const [doc] = useState(() => {
    useUiStore.getState().resetForDeck();
    useSaveStatusStore.getState().reset();
    const source: DeckSource =
      data.kind === 'stored' ? { kind: 'stored', bytes: data.bytes } : { kind: data.kind };
    return openDeck(source);
  });
  const save = useSaveControlsFor(data, doc);

  return (
    <SaveContext value={save}>
      <EditorProvider doc={doc}>
        <ToastProvider>
          <ReactFlowProvider>
            <EditorLayout />
          </ReactFlowProvider>
          <Toaster />
        </ToastProvider>
      </EditorProvider>
    </SaveContext>
  );
}

/**
 * Editor shell. The Yjs document is the single source of truth: every panel renders from
 * `useDeckSnapshot` and writes through `useEditor()`; storage attaches to it as a provider.
 */
export function EditorPage() {
  const data = useLoaderData<DeckLoaderData>();
  if (data.kind === 'not-found') return <DeckNotFoundPage />;
  return <EditorShell key={data.kind === 'stored' ? data.deckId : data.kind} data={data} />;
}
