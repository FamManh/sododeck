import { fromJSON, type DeckDoc, type DeckEditor } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactNode } from 'react';

import { createInlineProblemsClient } from '../editor/problems/problems-client';
import { ProblemsProvider } from '../editor/problems/problems-provider';
import { EditorProvider } from '../model/editor-context';
import { useUiStore } from '../state/ui-store';
import { EditorProbe } from './editor-probe';

const initialUi = useUiStore.getState();
const inlineProblems = createInlineProblemsClient();

/** Test deck from a partial file. */
export function deckOf(patch: Partial<SododeckFile>): SododeckFile {
  return { ...emptySododeckFile(), ...patch };
}

/**
 * The editor's providers as a `wrapper` (for render / renderHook), around a fresh doc. Resets the
 * UI store. `editor()` returns the editor the provider created.
 */
export function editorWrapper(file: SododeckFile | DeckDoc = emptySododeckFile()) {
  useUiStore.setState(initialUi, true);
  const doc = 'nodes' in file ? fromJSON(file) : file;
  const handle: { editor?: DeckEditor } = {};
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TooltipProvider>
      <ToastProvider>
        <EditorProvider doc={doc}>
          <EditorProbe
            onEditor={(editor) => {
              handle.editor = editor;
            }}
          />
          <ProblemsProvider doc={doc} client={inlineProblems}>
            <ReactFlowProvider>{children}</ReactFlowProvider>
          </ProblemsProvider>
        </EditorProvider>
        <Toaster />
      </ToastProvider>
    </TooltipProvider>
  );
  /** The editor the providers created (to undo/redo or edit from a test). */
  const editor = (): DeckEditor => {
    if (!handle.editor) throw new Error('editor not mounted');
    return handle.editor;
  };
  return { wrapper, doc, editor };
}

/** Renders `ui` inside the editor's providers. */
export function renderWithEditor(
  ui: ReactNode,
  file: SododeckFile | DeckDoc = emptySododeckFile(),
) {
  const { wrapper, doc, editor } = editorWrapper(file);
  return { ...render(ui, { wrapper }), doc, editor };
}
