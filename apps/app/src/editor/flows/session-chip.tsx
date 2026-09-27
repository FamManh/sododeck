import { Button } from '@sododeck/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { useToast } from '@sododeck/ui/components/toast';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Check, CircleDot, GitBranch, Undo2 } from 'lucide-react';
import { useId } from 'react';

import { isApplePlatform } from '../../lib/features';
import { readDeck, useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { findFlow } from './session-path';
import {
  addingBranchInfo,
  cancel,
  doneBlocker,
  finish,
  requestCancel,
  sessionTitle,
  undoLastStep,
} from './flow-session';
import { confirmBranch } from './confirm-branch';

/**
 * The session chip in the top bar (FR-007, designs 41–45): what is being recorded or edited, and
 * Undo last step (⌘Z), Done (disabled with its reason) and Cancel (Esc). Cancel asks first when
 * something would be lost.
 */
export function SessionChip() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const session = useUiStore((s) => s.flowSession);
  const { toast } = useToast();
  const reasonId = useId();
  if (session === null) return null;

  const title = sessionTitle(deck, session);
  const flow = findFlow(deck, session.flowId);
  const count = flow?.steps.length ?? 0;
  const branch = addingBranchInfo(deck, session);
  const blocker = branch === null ? doneBlocker(deck, session) : null;
  const text =
    branch !== null
      ? `Editing ‘${title}’ · adding branch after step ${branch.afterNumber}`
      : session.mode === 'record'
        ? `Recording ‘${title}’ · ${String(count)} ${count === 1 ? 'step' : 'steps'}`
        : `Editing ‘${title}’`;
  const apple = isApplePlatform();
  const Icon = branch !== null ? GitBranch : CircleDot;

  return (
    <div className="flex min-w-0 items-center gap-1 rounded-full bg-primary-soft py-1 pr-1 pl-3">
      <span role="status" className="flex min-w-0 items-center gap-2 text-body text-primary-ink">
        <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
        <span className="truncate" title={text}>
          {text}
        </span>
      </span>
      {session.mode === 'record' && branch === null && (
        <Button
          variant="ghost"
          size="sm"
          disabled={session.recorded.length === 0}
          onClick={() => {
            undoLastStep(editor);
          }}
        >
          <Undo2 />
          Undo last step
          <kbd className="font-sans text-caption text-ink-muted">{apple ? '⌘Z' : 'Ctrl+Z'}</kbd>
        </Button>
      )}
      <Button
        variant="primary"
        size="sm"
        aria-disabled={blocker !== null}
        aria-describedby={blocker === null ? undefined : reasonId}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => {
          if (branch !== null) {
            // Read at click time: a field blurred by this click has just committed.
            confirmBranch(readDeck(editor.doc));
            return;
          }
          if (blocker !== null) return;
          const message = finish(editor);
          if (message !== null) toast({ message });
        }}
      >
        <Check />
        Done
      </Button>
      {blocker !== null && (
        <span id={reasonId} className="sr-only">
          {blocker}
        </span>
      )}
      <Button
        size="sm"
        onClick={() => {
          requestCancel(editor);
        }}
      >
        Cancel
        <kbd className="font-sans text-caption text-ink-muted">Esc</kbd>
      </Button>
      <Dialog
        open={session.confirmingCancel}
        onOpenChange={(open) => {
          if (!open) useUiStore.getState().setConfirmingCancel(false);
        }}
      >
        <DialogContent role="alertdialog" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {session.mode === 'record' ? `Discard ‘${title}’?` : `Discard changes to ‘${title}’?`}
            </DialogTitle>
            <DialogDescription>
              {session.mode === 'record'
                ? `Its ${String(count)} recorded ${count === 1 ? 'step' : 'steps'} will be removed.`
                : 'Its steps and branches go back to how they were when editing started. Text edits are kept.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                useUiStore.getState().setConfirmingCancel(false);
              }}
            >
              Keep editing
            </Button>
            <Button
              className="border-clay-ink text-clay-ink hover:bg-clay-soft"
              onClick={() => {
                cancel(editor);
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
