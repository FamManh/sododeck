import { createEditor, isLegacyLayout, type DeckDoc } from '@sododeck/model';
import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData, useNavigate, useOutlet, useParams } from 'react-router';

import { dbPictureStore, memoryPictureStore, PictureStoreContext } from '../images/picture-store';
import { Announcer } from '../editor/announcer';
import { Canvas } from '../editor/canvas';
import { CommandPalette } from '../editor/command-palette/command-palette';
import { ConfirmDeleteDialog } from '../editor/confirm-delete-dialog';
import { DeckDeletedDialog } from '../editor/deck-deleted-dialog';
import { useFlowShortcuts, usePlaybackShortcuts } from '../editor/flows/use-flow-shortcuts';
import { useFlowSync } from '../editor/flows/use-flow-sync';
import { fitMissingFrames, openDeck, type DeckSource } from '../editor/open-deck';
import { SaveContext, type SaveControls } from '../editor/save-context';
import { nextProblem } from '../editor/problems/next-problem';
import { ProblemsProvider } from '../editor/problems/problems-provider';
import { useGoToProblem } from '../editor/problems/use-go-to-problem';
import { useProblems } from '../editor/problems/use-problems';
import { CanvasShell } from '../editor/shell/canvas-shell';
import { ShellChrome } from '../editor/shell/shell-chrome';
import { TopBar } from '../editor/top-bar';
import { RuleNavContext, type RuleNav } from '../editor/rules/rule-nav';
import { useEditorShortcuts } from '../editor/use-canvas-shortcuts';
import { EditorProvider } from '../model/editor-context';
import { useEditor } from '../model/use-editor';
import { readDeck, useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { sweepBlobs } from '../storage/blob-gc';
import { attachDeckChannel } from '../storage/deck-channel';
import { attachDeckPersistence, type DeckPersistence } from '../storage/deck-persistence';
import { markExported, markOpened } from '../storage/library-db';
import { isOwnUpdate } from '../storage/origins';
import { useSaveStatusStore } from '../storage/save-status';
import type { DeckLoaderData } from './deck-loader';
import { DeckNotFoundPage } from './deck-not-found-page';

/**
 * The canvas screen (the deck route's default), canvas-first (018, ADR 0014): the canvas fills
 * the window and every control floats over it. Flow keys (006) belong to this screen only.
 */
export function CanvasScreen() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const navigate = useNavigate();
  useFlowShortcuts();
  usePlaybackShortcuts();
  const ruleNav = useMemo<RuleNav>(
    () => ({
      openRules: (ruleId, options) => {
        void navigate(ruleId === undefined ? 'rules' : `rules/${encodeURIComponent(ruleId)}`, {
          state: options?.newRule === true ? { newRule: true } : undefined,
        });
      },
    }),
    [navigate],
  );

  return (
    <RuleNavContext value={ruleNav}>
      <CanvasShell canvas={<Canvas />}>
        <ShellChrome
          deck={deck}
          onOpenRules={() => {
            ruleNav.openRules();
          }}
        />
      </CanvasShell>
    </RuleNavContext>
  );
}

/**
 * What both screens share (research R8): the top bar, the delete confirmation, the live region,
 * document-wide keys and flow sync. The child route (the rule editor) renders below the top bar;
 * without one, the canvas screen does.
 */
function EditorChrome() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const outlet = useOutlet();
  const navigate = useNavigate();
  const { deckId } = useParams();
  const screen = outlet === null ? 'canvas' : 'rules';
  const deckPath = deckId === undefined ? '.' : `/deck/${encodeURIComponent(deckId)}`;
  const openRules = (ruleId?: string) => {
    void navigate(
      ruleId === undefined
        ? `${deckPath}/rules`
        : `${deckPath}/rules/${encodeURIComponent(ruleId)}`,
      { state: undefined },
    );
  };
  const navigateToCanvas = () => {
    void navigate(deckPath);
  };
  const problems = useProblems();
  const goToProblem = useGoToProblem({ screen, openRules, navigateToCanvas });
  useEditorShortcuts({
    canvas: screen === 'canvas',
    onProblem: (direction) => {
      const ui = useUiStore.getState();
      const next = nextProblem(problems?.list ?? [], ui.problemCursor, direction);
      if (next === null) ui.announce('No problems');
      else goToProblem(next);
    },
  });
  useFlowSync();

  return (
    <div className="h-dvh bg-app">
      {screen === 'rules' ? (
        <div className="grid h-dvh grid-rows-[56px_minmax(0,1fr)]">
          <TopBar deckName={deck.name ?? 'Untitled deck'} />
          {outlet}
        </div>
      ) : (
        <CanvasScreen />
      )}
      <CommandPalette screen={screen} openRules={openRules} navigateToCanvas={navigateToCanvas} />
      <ConfirmDeleteDialog deck={deck} />
      <Announcer />
    </div>
  );
}

/** Attaches storage to a stored deck and exposes flush/export bookkeeping to the editor. */
/** Loader data of a deck the editor can open. */
type OpenDeckData = Exclude<DeckLoaderData, { kind: 'not-found' }>;

function useSaveControlsFor(data: OpenDeckData, doc: DeckDoc) {
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

function EditorShell({ data, opened }: { data: OpenDeckData; opened: DeckDoc }) {
  const [doc] = useState(() => {
    useUiStore.getState().resetForDeck(data.kind === 'stored' ? data.deckId : null);
    useSaveStatusStore.getState().reset();
    return opened;
  });
  const save = useSaveControlsFor(data, doc);
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
  // After storage is attached (effects run in order), so the fitted frames are saved and synced.
  useEffect(() => {
    const fitter = createEditor(doc);
    fitMissingFrames(fitter, readDeck(doc));
    fitter.destroy();
  }, [doc]);

  return (
    <SaveContext value={save}>
      <PictureStoreContext value={pictures}>
        <EditorProvider doc={doc}>
          <ProblemsProvider doc={doc}>
            <ToastProvider>
              <ReactFlowProvider>
                <EditorChrome />
              </ReactFlowProvider>
              {data.kind === 'stored' && (
                <DeckDeletedDialog db={data.db} deckId={data.deckId} doc={doc} />
              )}
              <Toaster />
            </ToastProvider>
          </ProblemsProvider>
        </EditorProvider>
      </PictureStoreContext>
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
  return <EditorShell data={data} opened={doc} />;
}
