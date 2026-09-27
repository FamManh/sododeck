/**
 * The deck editor: the one way surfaces change a deck. It owns only session state (constitution
 * I): a transaction origin, a Y.UndoManager, the gesture depth, the last edited object and the id
 * generator. Undo covers only this editor's own transactions (research R5).
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YObject } from './convert';
import { indexOfId, rootTypes, type DeckDoc } from './deck';
import { DeckEditError } from './errors';
import { defaultNewId, makeIdAllocator, type IdPrefix } from './ids';

export interface EditorOptions {
  /** Typing-burst window in ms: edits to one object closer than this are one undo step. */
  captureTimeout?: number;
  /** Id generator, e.g. deterministic ids in tests. Collisions with existing ids are retried. */
  newId?: (prefix: string) => Id;
}

export interface DeckEditor {
  readonly doc: DeckDoc;
  /** Runs `fn` as one transaction: one change event, one undo step. Nested batches flatten. */
  batch<T>(fn: () => T): T;
  /** Undoes this editor's last step. Returns false when there is nothing to undo. */
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Detaches the undo history from the document. */
  destroy(): void;
}

/** What operation modules need from the editor. */
export interface EditContext {
  readonly doc: DeckDoc;
  transact<T>(fn: () => T): T;
  allocate(prefix: IdPrefix, reserved?: ReadonlySet<Id>): Id;
}

/** Origins of every live editor, so `observeDeck` can tell local edits from remote ones. */
export const editorOrigins = new WeakSet<object>();

export function findIndexById(array: Y.Array<YObject>, id: Id, what: string): number {
  const index = indexOfId(array, id);
  if (index === -1) {
    throw new DeckEditError('not-found', [
      { path: '', message: `${what} "${id}" does not exist.` },
    ]);
  }
  return index;
}

export function getMapById(array: Y.Array<YObject>, id: Id, what: string): YObject {
  return array.get(findIndexById(array, id, what));
}

export function createEditor(doc: DeckDoc, options: EditorOptions = {}): DeckEditor {
  const origin = { editor: 'sododeck' };
  editorOrigins.add(origin);

  const undoManager = new Y.UndoManager(rootTypes(doc), {
    trackedOrigins: new Set([origin]),
    captureTimeout: options.captureTimeout ?? 500,
  });

  const ctx: EditContext = {
    doc,
    // Yjs flattens nested transactions into the outermost one, which gives batches for free.
    transact: (fn) => {
      let result: ReturnType<typeof fn> | undefined;
      doc.transact(() => {
        result = fn();
      }, origin);
      return result as ReturnType<typeof fn>;
    },
    allocate: makeIdAllocator(doc, options.newId ?? defaultNewId),
  };

  return {
    doc,
    batch: (fn) => {
      undoManager.stopCapturing();
      return ctx.transact(fn);
    },
    undo: () => undoManager.undo() !== null,
    redo: () => undoManager.redo() !== null,
    canUndo: () => undoManager.canUndo(),
    canRedo: () => undoManager.canRedo(),
    destroy: () => {
      undoManager.destroy();
      editorOrigins.delete(origin);
    },
  };
}
