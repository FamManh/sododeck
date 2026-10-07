import { createEditor, type DeckDoc } from '@sododeck/model';
import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useOutlet, useParams } from 'react-router';

import { PictureStoreContext, type PictureStore } from '../images/picture-store';
import { EditorProvider } from '../model/editor-context';
import { readDeck, useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { useSaveStatusStore } from '../storage/save-status';
import { Announcer } from './announcer';
import { Canvas } from './canvas';
import { CommandPalette } from './command-palette/command-palette';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { DeckServicesContext, type DeckServices } from './deck-services';
import { EmbedHostContext, type EmbedHostValue } from './embed-host-context';
import { useFlowShortcuts, usePlaybackShortcuts } from './flows/use-flow-shortcuts';
import { useFlowSync } from './flows/use-flow-sync';
import { fitMissingFrames } from './open-deck';
import { nextProblem } from './problems/next-problem';
import { ProblemsProvider } from './problems/problems-provider';
import { useGoToProblem } from './problems/use-go-to-problem';
import { useProblems } from './problems/use-problems';
import { RuleNavContext, type RuleNav } from './rules/rule-nav';
import { SaveContext, type SaveControls } from './save-context';
import { CanvasShell } from './shell/canvas-shell';
import { ShellChrome } from './shell/shell-chrome';
import { TopBar } from './top-bar';
import { useEditorShortcuts } from './use-canvas-shortcuts';

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

export interface EditorShellProps {
  /** The open deck. The shell never builds or stores it: whoever opens the deck does. */
  doc: DeckDoc;
  save: SaveControls;
  pictures: PictureStore;
  /** The deck library (web app only); `null`: no library, and every control needing one is hidden. */
  services: DeckServices | null;
  /** What the editor may ask of a host program (embed); the web defaults when absent. */
  host?: EmbedHostValue;
  /** Extra UI that needs the deck's providers, such as the web app's "deleted in another tab". */
  extras?: ReactNode;
  /** Stored decks have an id: it keys per-deck shell preferences. `null` for anything else. */
  deckKey: string | null;
}

/**
 * The editor around one open deck, with no storage in it (067 R2): save controls, picture store
 * and library services come in as props. The web app's editor page and the embed both render it.
 * The Yjs document is the single source of truth: every panel renders from `useDeckSnapshot` and
 * writes through `useEditor()`.
 */
export function EditorShell({
  doc,
  save,
  pictures,
  services,
  host,
  extras,
  deckKey,
}: EditorShellProps) {
  useState(() => {
    useUiStore.getState().resetForDeck(deckKey);
    useSaveStatusStore.getState().reset();
  });
  // Effects run children first, so storage the parent attaches in a layout effect is in place
  // before this one writes: the fitted frames and the freed notes are saved and synced. A deck
  // stored before ADR 0041 may still pin notes: they become free where they are shown.
  useEffect(() => {
    const fitter = createEditor(doc);
    fitter.freeLegacyStickies();
    fitMissingFrames(fitter, readDeck(doc));
    fitter.destroy();
  }, [doc]);

  const body = (
    <SaveContext value={save}>
      <PictureStoreContext value={pictures}>
        <DeckServicesContext value={services}>
          <EditorProvider doc={doc}>
            <ProblemsProvider doc={doc}>
              <ToastProvider>
                <ReactFlowProvider>
                  <EditorChrome />
                </ReactFlowProvider>
                {extras}
                <Toaster />
              </ToastProvider>
            </ProblemsProvider>
          </EditorProvider>
        </DeckServicesContext>
      </PictureStoreContext>
    </SaveContext>
  );
  return host === undefined ? body : <EmbedHostContext value={host}>{body}</EmbedHostContext>;
}
