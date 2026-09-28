/**
 * Undo or redo of a change made in another view (011 FR-045): applied in place, and explained by
 * a toast "Undid <action> in <view>" with "Go to <view>". Changes to shared data (components,
 * connections, base positions) or to the current view show nothing extra.
 */
import { observeDeck, type ObjectChange } from '@sododeck/model';
import type { Id } from '@sododeck/schema';
import { useToast } from '@sododeck/ui/components/toast';
import { MOTION } from '@sododeck/ui/lib/motion';
import { useEffect } from 'react';

import { readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { currentViewIdOf, selectView } from './use-current-view';

export type UndoViewAction = 'move' | 'pin' | 'rename' | 'view settings' | 'change';

export interface UndoViewContext {
  viewId: Id;
  action: UndoViewAction;
}

const SETTINGS = new Set([
  'subtitleField',
  'feature',
  'excludeGroups',
  'excludeKinds',
  'excludeTags',
  'dimKinds',
]);

function actionOf(keys: readonly string[]): UndoViewAction {
  if (keys.includes('positions')) return 'move';
  if (keys.includes('pinned')) return 'pin';
  if (keys.includes('title')) return 'rename';
  if (keys.some((key) => SETTINGS.has(key))) return 'view settings';
  return 'change';
}

/** The other view an undo/redo changed alone, and what it undid; null when nothing to explain. */
export function describeUndo(
  changes: readonly ObjectChange[],
  currentViewId: Id,
): UndoViewContext | null {
  const first = changes[0];
  if (first === undefined || first.id === currentViewId) return null;
  const onlyThatView = changes.every(
    (c) => c.scope === 'views' && c.kind === 'updated' && c.id === first.id,
  );
  if (!onlyThatView) return null;
  return { viewId: first.id, action: actionOf(changes.flatMap((c) => c.keys)) };
}

export function undoMessage(origin: 'undo' | 'redo', action: UndoViewAction, title: string) {
  return `${origin === 'undo' ? 'Undid' : 'Redid'} ${action} in ${title}`;
}

/** Shows the toast and announcement of FR-045. Mount once on the canvas screen. */
export function useUndoAcrossViews(): void {
  const editor = useEditor();
  const { toast } = useToast();

  useEffect(
    () =>
      observeDeck(editor.doc, ({ origin, changes }) => {
        if (origin !== 'undo' && origin !== 'redo') return;
        const context = describeUndo(changes, currentViewIdOf(editor.doc));
        if (context === null) return;
        const view = readDeck(editor.doc).views.find((v) => v.id === context.viewId);
        if (view === undefined) return;
        const message = undoMessage(origin, context.action, view.title);
        useUiStore.getState().announce(message);
        toast({
          message,
          action: {
            label: `Go to ${view.title}`,
            onAction: () => {
              selectView(view);
            },
          },
          duration: MOTION.toastMs,
        });
      }),
    [editor.doc, toast],
  );
}
