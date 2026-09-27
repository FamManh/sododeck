/**
 * The deck editor: the one way surfaces change a deck. It owns only session state (constitution
 * I): a transaction origin, a Y.UndoManager, the gesture depth, the last edited object and the id
 * generator. Undo covers only this editor's own transactions (research R5).
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import type { Branch, Rule, SododeckFile, Step } from '@sododeck/schema';

import { defaultNewId, makeIdAllocator } from './ids';
import { rootTypes, type Collection, type DeckDoc, type ObjectOf } from './layout';
import {
  addBranch,
  appendStep,
  restoreFlowStructure,
  updateBranch,
  type FlowCheckpoint,
  type NewBranch,
} from './ops/branches';
import {
  removeBranch,
  removeObject,
  removeRule,
  removeStep,
  type RemovalResult,
} from './ops/cascade';
import { addObject, reorderObject, updateObject } from './ops/collections';
import { editorOrigins, type EditContext } from './ops/context';
import { updateMeta } from './ops/meta';
import {
  addRule,
  addRuleColumn,
  addRuleRow,
  moveRuleColumn,
  moveRuleRow,
  removeRuleColumn,
  removeRuleRow,
  renameRuleColumn,
  setRuleCell,
  updateRule,
} from './ops/rules';
import { addStep, moveStep, updateStep } from './ops/steps';
import type { NewObject, NewRule, NewStep, Patch } from './ops/types';

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
  /** Deletes an object with the cascade in data-model.md, as one change and one undo step. */
  remove(c: Collection, id: Id): RemovalResult;
  /** Moves an object to `toIndex` in its collection (clamped). */
  reorder(c: Collection, id: Id, toIndex: number): void;

  /** Adds a step at `index` (default: last). */
  addStep(flowId: Id, data: NewStep, index?: number): Id;
  updateStep(flowId: Id, stepId: Id, patch: Patch<Step>): void;
  /** Deletes one step; stickies anchored to it are kept and reported. */
  removeStep(flowId: Id, stepId: Id): RemovalResult;
  /**
   * Moves a step to `toIndex` in `flow.steps`. Refused (`invalid`) when it would leave the step's
   * path or put a main-path step after the branch step.
   */
  moveStep(flowId: Id, stepId: Id, toIndex: number): void;
  /** Appends a step at the end of a path (main when `branchId` is null), keeping normal order. */
  appendStep(flowId: Id, branchId: Id | null, data: NewStep): Id;

  /**
   * Adds a branch after main-path step `afterStepId`, optionally with its first step (ADR 0008).
   * Following main-path steps first become alternative "a" when the flow has no branches yet.
   * One undo step. Returns the new branch id and its first step id (or null).
   */
  addBranch(flowId: Id, afterStepId: Id, data: NewBranch): { branchId: Id; stepId: Id | null };
  updateBranch(flowId: Id, branchId: Id, patch: Patch<Branch>): void;
  /** Deletes a branch and its steps. */
  removeBranch(flowId: Id, branchId: Id): RemovalResult;
  /**
   * Restores a flow's steps and branches to a checkpoint from `captureFlowStructure`; objects that
   * still exist keep their current text fields. One undo step.
   */
  restoreFlowStructure(flowId: Id, checkpoint: FlowCheckpoint): void;

  /** Adds a decision table; `hitPolicy` defaults to `first`, columns and rows to none. */
  addRule(data: NewRule): Id;
  updateRule(id: Id, patch: Patch<Omit<Rule, 'inputs' | 'outputs' | 'rows'>>): void;
  /** Deletes a rule, detaching it from every node and step and dropping its sample inputs. */
  removeRule(id: Id): RemovalResult;
  /** Adds a column at `index` (default: last), with an empty cell in every row. */
  addRuleColumn(ruleId: Id, side: 'inputs' | 'outputs', label: string, index?: number): Id;
  renameRuleColumn(ruleId: Id, columnId: Id, label: string): void;
  /** Moves a column within its side, moving its cell in every row. */
  moveRuleColumn(ruleId: Id, columnId: Id, toIndex: number): void;
  /** Removes a column, its cells, and (for inputs) the matching sample inputs on steps. */
  removeRuleColumn(ruleId: Id, columnId: Id): RemovalResult;
  /** Adds a row at `index` (default: last); missing cells are `''`. */
  addRuleRow(ruleId: Id, cells?: { when?: string[]; then?: string[] }, index?: number): Id;
  setRuleCell(ruleId: Id, rowId: Id, columnId: Id, value: string): void;
  moveRuleRow(ruleId: Id, rowId: Id, toIndex: number): void;
  removeRuleRow(ruleId: Id, rowId: Id): void;

  /**
   * Runs `fn` as one transaction: one change event, one undo step (never merged with typing).
   * Nested batches flatten. Each operation inside still validates before it writes, but Yjs cannot
   * roll back: if `fn` throws halfway, the edits made before the throw stay applied.
   */
  batch<T>(fn: () => T): T;
  /**
   * Marks the start of a gesture (a drag, a multi-step form change): every edit until the
   * matching `endGesture` is one undo step, however long it takes. Calls nest and are counted.
   */
  beginGesture(): void;
  /** @throws Error when there is no open gesture. */
  endGesture(): void;
  /** Undoes this editor's last step. Returns false when there is nothing to undo. */
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Calls `listener` when undo or redo availability changes. Returns an unsubscribe function. */
  onHistoryChange(listener: () => void): () => void;
  /** Detaches the undo history from the document. */
  destroy(): void;
}

export function createEditor(doc: DeckDoc, options: EditorOptions = {}): DeckEditor {
  const origin = { editor: 'sododeck' };
  editorOrigins.add(origin);

  const undoManager = new Y.UndoManager(rootTypes(doc), {
    trackedOrigins: new Set([origin]),
    captureTimeout: options.captureTimeout ?? 500,
  });

  const ids = makeIdAllocator(doc, options.newId ?? defaultNewId, origin);

  // Undo grouping (research R5). Yjs merges tracked transactions closer than `captureTimeout`;
  // `stopCapturing()` forces the next one into a new step.
  let lastKey: string | undefined;
  let gestureDepth = 0;
  let savedTimeout = undoManager.captureTimeout;

  const ctx: EditContext = {
    doc,
    transact: (fn, key) => {
      // Inside a gesture everything merges; outside, a new object or a structural edit starts a
      // new step. Yjs flattens nested transactions into the outermost one (batches).
      if (gestureDepth === 0 && (key === undefined || key !== lastKey)) undoManager.stopCapturing();
      lastKey = key;
      let result: ReturnType<typeof fn> | undefined;
      doc.transact(() => {
        result = fn();
      }, origin);
      return result as ReturnType<typeof fn>;
    },
    allocate: (prefix, reserved) => ids.allocate(prefix, reserved),
    reserve: (list) => {
      ids.reserve(list);
    },
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
    remove: (c, id) => removeObject(ctx, c, id),
    reorder: (c, id, toIndex) => {
      reorderObject(ctx, c, id, toIndex);
    },
    addStep: (flowId, data, index) => addStep(ctx, flowId, data, index),
    updateStep: (flowId, stepId, patch) => {
      updateStep(ctx, flowId, stepId, patch);
    },
    removeStep: (flowId, stepId) => removeStep(ctx, flowId, stepId),
    moveStep: (flowId, stepId, toIndex) => {
      moveStep(ctx, flowId, stepId, toIndex);
    },
    appendStep: (flowId, branchId, data) => appendStep(ctx, flowId, branchId, data),
    addBranch: (flowId, afterStepId, data) => addBranch(ctx, flowId, afterStepId, data),
    updateBranch: (flowId, branchId, patch) => {
      updateBranch(ctx, flowId, branchId, patch);
    },
    removeBranch: (flowId, branchId) => removeBranch(ctx, flowId, branchId),
    restoreFlowStructure: (flowId, checkpoint) => {
      restoreFlowStructure(ctx, flowId, checkpoint);
    },
    addRule: (data) => addRule(ctx, data),
    updateRule: (id, patch) => {
      updateRule(ctx, id, patch);
    },
    removeRule: (id) => removeRule(ctx, id),
    addRuleColumn: (ruleId, side, label, index) => addRuleColumn(ctx, ruleId, side, label, index),
    renameRuleColumn: (ruleId, columnId, label) => {
      renameRuleColumn(ctx, ruleId, columnId, label);
    },
    moveRuleColumn: (ruleId, columnId, toIndex) => {
      moveRuleColumn(ctx, ruleId, columnId, toIndex);
    },
    removeRuleColumn: (ruleId, columnId) => removeRuleColumn(ctx, ruleId, columnId),
    addRuleRow: (ruleId, cells, index) => addRuleRow(ctx, ruleId, cells, index),
    setRuleCell: (ruleId, rowId, columnId, value) => {
      setRuleCell(ctx, ruleId, rowId, columnId, value);
    },
    moveRuleRow: (ruleId, rowId, toIndex) => {
      moveRuleRow(ctx, ruleId, rowId, toIndex);
    },
    removeRuleRow: (ruleId, rowId) => {
      removeRuleRow(ctx, ruleId, rowId);
    },
    batch: (fn) => ctx.transact(fn),
    beginGesture: () => {
      if (gestureDepth++ === 0) {
        undoManager.stopCapturing();
        savedTimeout = undoManager.captureTimeout;
        undoManager.captureTimeout = Infinity;
      }
    },
    endGesture: () => {
      if (gestureDepth === 0) throw new Error('endGesture() called without beginGesture().');
      if (--gestureDepth === 0) {
        undoManager.captureTimeout = savedTimeout;
        undoManager.stopCapturing();
        lastKey = undefined;
      }
    },
    undo: () => undoManager.undo() !== null,
    redo: () => undoManager.redo() !== null,
    canUndo: () => undoManager.canUndo(),
    canRedo: () => undoManager.canRedo(),
    onHistoryChange: (listener) => {
      // Yjs emits a pop and a push per undo/redo; notify once per change of availability.
      let last = [undoManager.canUndo(), undoManager.canRedo()].join();
      const handler = () => {
        const now = [undoManager.canUndo(), undoManager.canRedo()].join();
        if (now !== last) {
          last = now;
          listener();
        }
      };
      const events = ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const;
      for (const event of events) undoManager.on(event, handler);
      return () => {
        for (const event of events) undoManager.off(event, handler);
      };
    },
    destroy: () => {
      undoManager.destroy();
      ids.destroy();
      editorOrigins.delete(origin);
    },
  };
}
