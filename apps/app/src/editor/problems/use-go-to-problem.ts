import type { Problem } from '@sododeck/model';
import { useToast } from '@sododeck/ui/components/toast';
import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

import { readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { openFlow } from '../flows/flow-mode';
import { firstViewShowing } from '../view-filter';
import { readViewState } from '../views/use-current-view';
import { goToProblem } from './go-to-problem';

export interface ProblemNavTargets {
  screen: 'canvas' | 'rules';
  openRules: (ruleId?: string) => void;
  navigateToCanvas: () => void;
}

/**
 * `goToProblem` bound to this editor, React Flow viewport, toasts and screen (015 FR-017–019),
 * built like the command palette's opening so both behave the same.
 */
export function useGoToProblem({
  screen,
  openRules,
  navigateToCanvas,
}: ProblemNavTargets): (problem: Problem) => boolean {
  const editor = useEditor();
  const { fitView, getZoom, getViewport, setCenter } = useReactFlow();
  const { toast } = useToast();
  return useCallback(
    (problem: Problem) => {
      const ui = useUiStore.getState();
      const announce = ui.announce;
      return goToProblem(problem, {
        editor,
        screen,
        announce,
        openRules,
        navigateToCanvas,
        fitView,
        setCenter,
        getZoom,
        getViewport,
        select: ui.select,
        focus: ui.focus,
        exitFlow: ui.exitFlow,
        openFlow,
        isHidden: (id) => readViewState(editor.doc).hidden.has(id),
        firstViewShowing: (id) =>
          firstViewShowing(readDeck(editor.doc), readViewState(editor.doc).views, id),
        showToast: (message, action) => {
          toast(action === undefined ? { message } : { message, action });
          announce(message);
          if (action === undefined) return;
          requestAnimationFrame(() => {
            [...document.querySelectorAll<HTMLButtonElement>('button')]
              .find((button) => button.textContent === action.label)
              ?.focus();
          });
        },
      });
    },
    [editor, screen, openRules, navigateToCanvas, fitView, setCenter, getZoom, getViewport, toast],
  );
}
