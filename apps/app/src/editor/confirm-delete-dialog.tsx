import { checkDeck, previewRemoval, removeTarget, type RemovalTarget } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { isApplePlatform } from '../lib/features';
import { readDeck } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore, type PendingDelete } from '../state/ui-store';
import { focusCanvas } from './canvas-actions';
import { describeRemoval, keptTables, removalToast, withNewProblems } from './describe-removal';
import { tableCounts } from '../db/owner';
import { belowCard, placeTables, writeBasePositions } from './place-tables';
import { withoutLocked } from './lock';
import { useUndoToast } from './undo-toast';

/** Canvas objects delete at once (founder, 2026-10-02): the Undo toast is the safety net. */
const CANVAS_SCOPES: ReadonlySet<RemovalTarget['scope']> = new Set([
  'nodes',
  'edges',
  'stickies',
  'groups',
]);

/**
 * Off-canvas objects ask first (§g-11), and so does a database card that owns tables (049): its
 * tables stay, unowned, which is easy to miss on a canvas that no longer shows the card.
 */
const needsConfirmation = (deck: SododeckFile, targets: readonly RemovalTarget[]): boolean =>
  targets.some(
    (target) =>
      !CANVAS_SCOPES.has(target.scope) ||
      (target.scope === 'nodes' && (tableCounts(deck).get(target.id) ?? 0) > 0),
  );

/**
 * Runs a requested delete (FR-017–019). Cards, notes, connectors and cut groups go at once;
 * flows, features, branches and rules still ask first (§g-11), since they are off-canvas and
 * easy to lose track of. The counts come from `previewRemoval`, which runs the model's real
 * cascade, so they match what the delete does. One batch = one undo step, then a 6 s toast with
 * Undo (⌘Z keeps working after it is gone).
 */
export function ConfirmDeleteDialog({ deck }: { deck: SododeckFile }) {
  const pending = useUiStore((s) => s.pendingDelete);
  if (pending === null) return null;
  const targets = pending.targets as RemovalTarget[];
  if (!needsConfirmation(deck, targets)) return <DeleteNow deck={deck} pending={pending} />;
  return <ConfirmDeleteContent deck={deck} pending={pending} />;
}

/** Gives tables left without their card a free spot below where the card was (049). */
function placeKeptTables(
  editor: ReturnType<typeof useEditor>,
  deck: SododeckFile,
  kept: readonly string[],
): void {
  const byCard = new Map<string, string[]>();
  for (const id of kept) {
    const parent = deck.nodes.find((node) => node.id === id)?.parent;
    if (parent !== undefined) byCard.set(parent, [...(byCard.get(parent) ?? []), id]);
  }
  for (const [cardId, ids] of byCard) {
    writeBasePositions(editor, deck, placeTables(deck, ids, undefined, belowCard(deck, cardId)));
  }
}

/** The delete itself, shared by the confirmation and the immediate canvas path. */
function useRunDelete(deck: SododeckFile, requested: RemovalTarget[]) {
  const editor = useEditor();
  const showUndoToast = useUndoToast();
  return () => {
    const { targets, skipped } = withoutLocked(deck, requested);
    const skippedText = `Skipped ${String(skipped)} locked`;
    if (targets.length === 0) {
      const ui = useUiStore.getState();
      ui.cancelDelete();
      ui.announce(skipped > 0 ? `${skippedText} · unlock to delete` : 'Nothing to delete');
      return;
    }
    const preview = previewRemoval(deck, targets);
    // The one synchronous problems check (015 FR-026, ADR 0013): before and after this delete.
    const before = checkDeck(readDeck(editor.doc)).total;
    const kept = keptTables(deck, targets, preview);
    editor.batch(() => {
      // A connection may already be gone with its component (cascade): removeTarget skips it.
      for (const target of targets) removeTarget(editor, editor.doc, target);
      // Tables a deleted database card owned stay, unowned, in free space on the level above.
      placeKeptTables(editor, deck, kept);
    });
    const removed = withNewProblems(
      removalToast(deck, targets, preview, isApplePlatform()),
      before,
      checkDeck(readDeck(editor.doc)).total,
    );
    const message = skipped > 0 ? `${removed} · ${skippedText}` : removed;
    const ui = useUiStore.getState();
    ui.cancelDelete();
    if (!needsConfirmation(deck, targets)) {
      ui.clearSelection();
      // The drawer or menu that asked may be gone with the object: keep keyboard users on the canvas.
      focusCanvas();
    }
    ui.announce(message);
    showUndoToast(message);
  };
}

function DeleteNow({ deck, pending }: { deck: SododeckFile; pending: PendingDelete }) {
  const run = useRunDelete(deck, pending.targets as RemovalTarget[]);
  // Once per request: `pending` is a new object for every requestDelete.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, [pending]);
  return null;
}

function ConfirmDeleteContent({ deck, pending }: { deck: SododeckFile; pending: PendingDelete }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const targets = pending.targets as RemovalTarget[];
  // Computed once when the dialog opens; the deck cannot change underneath a modal dialog.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preview = useMemo(() => previewRemoval(deck, targets), [targets]);
  const { title, body } = describeRemoval(deck, targets, preview);
  const confirm = useRunDelete(deck, targets);

  const cancel = () => {
    useUiStore.getState().cancelDelete();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <DialogContent
        role="alertdialog"
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button ref={cancelRef} onClick={cancel}>
            Cancel
          </Button>
          <Button className="border-clay-ink text-clay-ink hover:bg-clay-soft" onClick={confirm}>
            <Trash2 />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
