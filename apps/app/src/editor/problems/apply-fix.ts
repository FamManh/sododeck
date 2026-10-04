/**
 * Applies a problem's one-click fix (047 R5). The list and the popover share this path: every
 * write fix is one undo step and announces what it did; fixes that need a decision (rename, pick
 * a column, add values, change a type by hand) open the place where the user makes it. Fixes on a
 * locked table are refused (043 FR-023).
 */
import type { DeckEditor, Problem, ProblemFix } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';
import { useCallback } from 'react';

import { applyJunction, planJunction } from '../../db/junction-table';
import { readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { isNodeLocked, LOCKED_HINT, refuseLocked } from '../lock';
import { useUndoToast } from '../undo-toast';

export interface FixContext {
  editor: DeckEditor;
  /** Shows a message with an Undo button (the delete fix). */
  undoToast?: (message: string) => void;
}

/** The table a fix edits, when it edits one (a locked table refuses it). */
function tableOf(fix: ProblemFix): Id | null {
  switch (fix.kind) {
    case 'make-pk':
    case 'add-id-pk':
    case 'match-type':
    case 'remove-default':
    case 'allow-null':
    case 'pick-type':
      return fix.tableId;
    case 'rename':
      return fix.target.type === 'enum' ? null : fix.target.tableId;
    default:
      return null;
  }
}

/** Why `fix` cannot run now (its table is locked), or null. The buttons use it to disable. */
export function fixLockedReason(deck: Pick<SododeckFile, 'nodes'>, fix: ProblemFix): string | null {
  const tableId = tableOf(fix);
  return tableId !== null && isNodeLocked(deck, tableId) ? LOCKED_HINT : null;
}

const nameOf = (deck: SododeckFile, tableId: Id) =>
  deck.nodes.find((n) => n.id === tableId)?.title ?? tableId;

const columnName = (deck: SododeckFile, tableId: Id, columnId: Id) =>
  deck.nodes.find((n) => n.id === tableId)?.columns?.find((c) => c.id === columnId)?.name ??
  columnId;

/** Runs `fix`; false when nothing was done (locked, or its target is gone). */
export function applyFix(ctx: FixContext, _problem: Problem, fix: ProblemFix): boolean {
  const { editor } = ctx;
  const ui = useUiStore.getState();
  const deck = readDeck(editor.doc);
  if (fixLockedReason(deck, fix) !== null) return !refuseLocked();
  switch (fix.kind) {
    case 'remove-value':
      oneStep(editor, () => {
        editor.setValues([fix.nodeId], fix.fieldId, null);
      });
      ui.announce('Value removed');
      return true;
    case 'make-pk':
      oneStep(editor, () => {
        editor.updateColumn(fix.tableId, fix.columnId, { pk: true });
      });
      ui.announce(
        `${columnName(deck, fix.tableId, fix.columnId)} is now the primary key of ${nameOf(deck, fix.tableId)}`,
      );
      return true;
    case 'add-id-pk':
      oneStep(editor, () => {
        editor.addColumn(fix.tableId, { name: 'id', type: fix.type, pk: true, notNull: true }, 0);
      });
      ui.announce(`Added id ${fix.type} as the primary key of ${nameOf(deck, fix.tableId)}`);
      return true;
    case 'match-type': {
      editor.batch(() => {
        for (const change of fix.changes) {
          editor.updateColumn(fix.tableId, change.columnId, {
            type: change.type,
            size: change.size ?? null,
          });
        }
      });
      const [first] = fix.changes;
      ui.announce(
        fix.changes.length === 1 && first !== undefined
          ? `${columnName(deck, fix.tableId, first.columnId)} is now ${first.type}${first.size === undefined ? '' : `(${first.size})`}`
          : `${String(fix.changes.length)} columns of ${nameOf(deck, fix.tableId)} changed`,
      );
      return true;
    }
    case 'create-junction': {
      const plan = planJunction(deck, fix.edgeId);
      if (plan === null) return false;
      const id = applyJunction(editor, plan, fix.edgeId);
      ui.select({ nodes: [id] });
      ui.focus(id);
      ui.announce(`Created ${plan.name}`);
      return true;
    }
    case 'remove-default': {
      const column = deck.nodes
        .find((n) => n.id === fix.tableId)
        ?.columns?.find((c) => c.id === fix.columnId);
      if (column === undefined) return false;
      oneStep(editor, () => {
        editor.updateColumn(
          fix.tableId,
          fix.columnId,
          column.defaultExpr === undefined ? { default: null } : { defaultExpr: null },
        );
      });
      ui.announce(
        `Removed the default of ${nameOf(deck, fix.tableId)}.${columnName(deck, fix.tableId, fix.columnId)}`,
      );
      return true;
    }
    case 'allow-null':
      oneStep(editor, () => {
        editor.updateColumn(fix.tableId, fix.columnId, { notNull: null });
      });
      ui.announce(
        `${nameOf(deck, fix.tableId)}.${columnName(deck, fix.tableId, fix.columnId)} now allows null`,
      );
      return true;
    case 'delete-edge': {
      if (!deck.edges.some((e) => e.id === fix.edgeId)) return false;
      oneStep(editor, () => {
        editor.remove('edges', fix.edgeId);
      });
      const message = 'Deleted the duplicate relationship';
      ui.announce(message);
      ctx.undoToast?.(message);
      return true;
    }
    case 'rename': {
      const { target } = fix;
      if (target.type === 'table') {
        ui.select({ nodes: [target.tableId] });
        ui.focus(target.tableId);
        ui.startTitleEdit({ target: 'node', id: target.tableId, isNew: false, kind: 'db-table' });
      } else if (target.type === 'column') {
        ui.openTableDrawer(target.tableId, { tab: 'columns', columnId: target.columnId });
      } else if (target.type === 'index') {
        ui.openTableDrawer(target.tableId, { tab: 'indexes' });
      } else {
        ui.openEnumDrawer(target.enumId, { selectName: true });
      }
      return true;
    }
    case 'pick-column':
      ui.select({ edges: [fix.edgeId] });
      ui.openDrawer('selection');
      return true;
    case 'add-values':
      ui.openEnumDrawer(fix.enumId);
      return true;
    case 'pick-type':
      ui.openTableDrawer(fix.tableId, { tab: 'columns', columnId: fix.columnId });
      return true;
  }
}

/** `applyFix` bound to this editor and the Undo toast. */
export function useApplyFix(): (problem: Problem, fix: ProblemFix) => boolean {
  const editor = useEditor();
  const undoToast = useUndoToast();
  return useCallback(
    (problem, fix) => applyFix({ editor, undoToast }, problem, fix),
    [editor, undoToast],
  );
}
