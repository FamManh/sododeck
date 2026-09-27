/**
 * The deck editor: the one way surfaces change a deck. It owns only session state (constitution
 * I): a transaction origin, a Y.UndoManager, the gesture depth, the last edited object and the id
 * generator. Undo covers only this editor's own transactions (research R5).
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import type { SododeckFile, Step } from '@sododeck/schema';

import type { YObject } from './convert';
import { indexOfId, rootTypes, type Collection, type DeckDoc, type ObjectOf } from './deck';
import { DeckEditError } from './errors';
import { defaultNewId, makeIdAllocator, type IdPrefix } from './ids';
import { addObject, reorderObject, updateObject } from './ops/collections';
import { updateMeta } from './ops/meta';
import { addStep, moveStep, updateStep } from './ops/steps';
import type { NewObject, NewStep, Patch } from './ops/types';

export interface EditorOptions {
  /** Typing-burst window in ms: edits to one object closer than this are one undo step. */
  captureTimeout?: number;
  /** Id generator, e.g. deterministic ids in tests. Collisions with existing ids are retried. */
  newId?: (prefix: string) => Id;
}

/**
 * Typed, validated edit operations. Every method validates first and throws `DeckEditError`
 * without writing anything; after any successful call the deck exports a valid file.
 */
export interface DeckEditor {
  readonly doc: DeckDoc;

  /** Sets or clears (`null`) the deck's name, description and tags. */
  updateMeta(patch: Patch<Pick<SododeckFile, 'name' | 'description' | 'tags'>>): void;

  /** Adds an object and returns its id (generated unless `data.id` is given). */
  add<C extends Collection>(c: C, data: NewObject<C>): Id;
  /** Changes fields; `null` clears an optional field. Move = `position`, regroup = `group`. */
  update<C extends Collection>(c: C, id: Id, patch: Patch<ObjectOf<C>>): void;
  /** Moves an object to `toIndex` in its collection (clamped). */
  reorder(c: Collection, id: Id, toIndex: number): void;

  /** Adds a step at `index` (default: last). */
  addStep(flowId: Id, data: NewStep, index?: number): Id;
  updateStep(flowId: Id, stepId: Id, patch: Patch<Step>): void;
  moveStep(flowId: Id, stepId: Id, toIndex: number): void;

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
    updateMeta: (patch) => {
      updateMeta(ctx, patch);
    },
    add: (c, data) => addObject(ctx, c, data),
    update: (c, id, patch) => {
      updateObject(ctx, c, id, patch);
    },
    reorder: (c, id, toIndex) => {
      reorderObject(ctx, c, id, toIndex);
    },
    addStep: (flowId, data, index) => addStep(ctx, flowId, data, index),
    updateStep: (flowId, stepId, patch) => {
      updateStep(ctx, flowId, stepId, patch);
    },
    moveStep: (flowId, stepId, toIndex) => {
      moveStep(ctx, flowId, stepId, toIndex);
    },
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
