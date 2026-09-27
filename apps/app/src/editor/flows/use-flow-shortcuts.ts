/**
 * Flow keys (006 contracts/flow-authoring-ui.md): / focuses the flow filter from anywhere in the
 * editor (not while typing); on a focused step row during a session, ⌫ removes it and B starts a
 * branch after it. ⌥↑ / ⌥↓ come from `use-sortable-list`, F2 from the rows themselves. In flow
 * mode (007) ← / → step and ↑ / ↓ switch alternatives at a fork.
 */
import type { DeckEditor } from '@sododeck/model';
import { DeckEditError } from '@sododeck/model';
import type { KeyboardEvent } from 'react';
import { useEffect } from 'react';

import { isTextTarget } from '../../lib/is-text-target';
import { readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { FLOW_FILTER_ID } from './flow-filter';
import { nextStep, previousStep, switchAlternative } from './flow-mode';
import { analysisOf, startBranch } from './flow-session';

/** / focuses "Filter flows" (FR-035). Install once per editor page. */
export function useFlowShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== '/' || event.metaKey || event.ctrlKey) return;
      if (isTextTarget(event.target) || useUiStore.getState().flowSession !== null) return;
      const filter = document.getElementById(FLOW_FILTER_ID);
      if (filter === null) return;
      event.preventDefault();
      filter.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}

/** Where arrow keys keep their own meaning: dialogs, menus, radio groups, listboxes, sliders. */
const OWNS_ARROWS =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="radiogroup"], [role="listbox"], [role="slider"]';

/**
 * Flow mode keys (007 contracts/flow-playback-ui.md): → / ← next / previous step, ↓ / ↑ next /
 * previous alternative while the branch picker shows. Not in text fields or widgets that own the
 * arrows. Install once per editor page.
 */
export function usePlaybackShortcuts(): void {
  const editor = useEditor();
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.shiftKey || !isFlowMode(useUiStore.getState())) return;
      if (isTextTarget(event.target)) return;
      if (event.target instanceof Element && event.target.closest(OWNS_ARROWS) !== null) return;
      const action = {
        ArrowRight: () => {
          nextStep(editor);
        },
        ArrowLeft: () => {
          previousStep(editor);
        },
        ArrowDown: () => {
          switchAlternative(editor, 1);
        },
        ArrowUp: () => {
          switchAlternative(editor, -1);
        },
      }[event.key];
      if (action === undefined) return;
      event.preventDefault();
      action();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [editor]);
}

/**
 * Removes a step in a session with no dialog (FR-004: ⌘Z restores it). The branch step is refused
 * while branches exist: removing it would silently re-home every branch (research R5).
 */
export function removeSessionStep(editor: DeckEditor, flowId: string, stepId: string): boolean {
  const ui = useUiStore.getState();
  const analysis = analysisOf(readDeck(editor.doc), flowId);
  const number = analysis?.byStepId.get(stepId)?.number ?? '';
  if (analysis?.branchStepId === stepId) {
    ui.announce('Delete its branches first');
    return false;
  }
  try {
    editor.removeStep(flowId, stepId);
  } catch (error) {
    if (error instanceof DeckEditError) return false;
    throw error;
  }
  ui.announce(`Removed step ${number}`);
  return true;
}

/** Keys of a focused step row during a session: ⌫ / Delete removes, B adds a branch. */
export function stepRowKeyDown(
  event: KeyboardEvent,
  editor: DeckEditor,
  flowId: string,
  stepId: string,
): void {
  if (event.altKey || event.metaKey || event.ctrlKey) return;
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    removeSessionStep(editor, flowId, stepId);
  } else if (event.key.toLowerCase() === 'b') {
    event.preventDefault();
    startBranch(editor, stepId);
  }
}
