import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useParams } from 'react-router';

import { Announcer } from '../editor/announcer';
import { Canvas } from '../editor/canvas';
import { ConfirmDeleteDialog } from '../editor/confirm-delete-dialog';
import { Inspector } from '../editor/inspector';
import { JsonPanel } from '../editor/json-panel';
import { LeftSidebar } from '../editor/left-sidebar';
import { openDeck } from '../editor/open-deck';
import { TopBar } from '../editor/top-bar';
import { useEditorShortcuts } from '../editor/use-canvas-shortcuts';
import { EditorProvider } from '../model/editor-context';
import { useEditor } from '../model/use-editor';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';

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

function EditorShell({ deckId }: { deckId: string }) {
  const [doc] = useState(() => {
    useUiStore.getState().resetForDeck();
    return openDeck(deckId);
  });
  return (
    <EditorProvider doc={doc}>
      <ToastProvider>
        <ReactFlowProvider>
          <EditorLayout />
        </ReactFlowProvider>
        <Toaster />
      </ToastProvider>
    </EditorProvider>
  );
}

/**
 * Editor shell. The Yjs document is the single source of truth: every panel renders from
 * `useDeckSnapshot` and writes through `useEditor()`. TODO(M1): load by :deckId from IndexedDB.
 */
export function EditorPage() {
  const { deckId = 'demo' } = useParams();
  return <EditorShell key={deckId} deckId={deckId} />;
}
