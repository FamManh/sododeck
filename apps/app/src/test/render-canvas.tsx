import { fromJSON, type DeckDoc, type DeckEditor } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactNode } from 'react';

import { EditorProvider } from '../model/editor-context';
import { useUiStore } from '../state/ui-store';
import { EditorProbe } from './editor-probe';

const initialUi = useUiStore.getState();

/** Test deck from a partial file. */
export function deckOf(patch: Partial<SododeckFile>): SododeckFile {
  return { ...emptySododeckFile(), ...patch };
}

/** Wraps `ui` in the providers the editor needs; resets the UI store first. */
export function renderWithEditor(
  ui: ReactNode,
  file: SododeckFile | DeckDoc = emptySododeckFile(),
) {
  useUiStore.setState(initialUi, true);
  const doc = 'nodes' in file ? fromJSON(file) : file;
  const handle: { editor?: DeckEditor } = {};
  const result = render(
    <TooltipProvider>
      <ToastProvider>
        <EditorProvider doc={doc}>
          <EditorProbe
            onEditor={(editor) => {
              handle.editor = editor;
            }}
          />
          <ReactFlowProvider>{ui}</ReactFlowProvider>
        </EditorProvider>
        <Toaster />
      </ToastProvider>
    </TooltipProvider>,
  );
  /** The editor the providers created (to undo/redo or edit from a test). */
  const editor = (): DeckEditor => {
    if (!handle.editor) throw new Error('editor not mounted');
    return handle.editor;
  };
  return { ...result, doc, editor };
}
