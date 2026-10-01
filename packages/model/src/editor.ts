/**
 * The deck editor: the one way surfaces change a deck. It owns only session state (constitution
 * I): a transaction origin, a Y.UndoManager, the gesture depth, the last edited object and the id
 * generator. Undo covers only this editor's own transactions (research R5).
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import type {
  Branch,
  Frame,
  Rule,
  SododeckFile,
  Size,
  Step,
  Sticky,
  ViewType,
} from '@sododeck/schema';

import { defaultNewId, makeIdAllocator } from './ids';
import { getObject } from './deck';
import { DeckEditError } from './errors';
import type { Point } from './geometry';
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
import { fillGroupFrames, setGroupFrames } from './ops/frames';
import { pasteFragment, type PasteOptions, type PastedIds } from './ops/paste';
import { groupSelection, type GroupSelection } from './ops/group-selection';
import { setCardSize, setEdgeRoute, type EdgeRoutePatch } from './ops/shape';
import type { Fragment } from './fragment';
import { editorOrigins, type EditContext } from './ops/context';
import { updateMeta } from './ops/meta';
import { setStyle, type StyleChannel, type StyleTargets } from './ops/style';
import { addSwatch, removeSwatch } from './ops/swatches';
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
import { attachRule, detachRule, setRuleInputs, type RuleHost } from './ops/rule-links';
import { addStep, moveStep, updateStep } from './ops/steps';
import {
  addSticky,
  deleteStickyIfPresent,
  moveSticky,
  pinSticky,
  unpinSticky,
} from './ops/stickies';
import type { NewObject, NewRule, NewStep, Patch } from './ops/types';
import {
  addView,
  moveInView,
  removeView,
  setCollapsed,
  setPinned,
  updateView,
  type ViewSettingsPatch,
} from './ops/views';

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

  /** Sets or clears (`null`) the deck's name, description, tags and custom colour swatches. */
  updateMeta(patch: Patch<Pick<SododeckFile, 'name' | 'description' | 'tags' | 'swatches'>>): void;

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
   * Appends `ruleId` to a node's or step's rules (008). Throws `missing-reference` (no such rule
   * or host) or `invalid` (already attached). One undo step.
   */
  attachRule(host: RuleHost, ruleId: Id): void;
  /**
   * Removes `ruleId` from the host's rules (the field goes when empty); on a step its sample
   * inputs for that rule go in the same transaction. No-op when not attached.
   */
  detachRule(host: RuleHost, ruleId: Id): void;
  /**
   * Replaces a step's sample inputs for one attached rule: empty values are dropped, the rule's
   * key goes when nothing is left. A typing burst is one undo step. Throws `missing-reference`
   * when the rule is not attached or a key is not one of its input columns.
   */
  setRuleInputs(flowId: Id, stepId: Id, ruleId: Id, values: Readonly<Record<Id, string>>): void;

  /**
   * Adds a note and opens a draft: text edits to it (through `update('stickies', id, …)`) merge
   * into the same undo step regardless of how long typing takes. Throws `invalid` if a draft is
   * already open. Returns the new id.
   */
  beginStickyDraft(sticky: Omit<Sticky, 'id'>): Id;
  /**
   * Ends the open draft. Blank text (or a note removed by another tab) removes the note and, when
   * nothing else was recorded meanwhile, drops the draft's undo step entirely, so it leaves no
   * undo or redo entry. Otherwise the note is removed as a normal step. Returns `'kept'` or
   * `'discarded'`. Throws `invalid` when `id` is not the open draft.
   */
  endStickyDraft(id: Id): 'kept' | 'discarded';
  /** Pins a note to a node, keeping its canvas point. Throws `missing-reference` for an unknown node. */
  pinSticky(id: Id, nodeId: Id): void;
  /** Unpins a note, keeping its canvas point. */
  unpinSticky(id: Id): void;
  /** Moves a note to a canvas point: an offset when pinned, an absolute point otherwise. */
  moveSticky(id: Id, point: Point): void;

  /**
   * Moves nodes in a view (011, FR-020/021). In the base view (the first) this writes
   * `node.position` and drops that view's own entry for the node; in other views it writes
   * `view.positions`. Unknown node ids are skipped. Merges inside a gesture or batch.
   * A deck without stored views first stores the presets, outside undo history (FR-001).
   */
  moveInView(viewId: Id, positions: Readonly<Record<Id, Point>>): void;
  /** Pins or unpins nodes in one view (FR-022). One undo step; `missing-reference` for unknown nodes. */
  setPinned(viewId: Id, nodeIds: readonly Id[], pinned: boolean): void;
  /**
   * Changes a view's title and settings; `undefined` or `[]` removes a field. Blank titles and
   * bad kinds are `invalid`; unknown groups or features are `missing-reference`. A title typing
   * burst is one undo step.
   */
  updateView(viewId: Id, patch: ViewSettingsPatch): void;
  /** Appends a view ("Custom <n>", type `custom`, by default) and returns its id. */
  addView(data?: { title?: string; type?: ViewType }): Id;
  /** Deletes a view; the last one is refused (`invalid`). Undo restores every field. */
  removeView(viewId: Id): RemovalResult;
  /**
   * Collapses or expands a group in a view (FR-050). Saved and synced (reported as `local`),
   * but never an undo step: `canUndo()` does not change and undo never touches it.
   */
  setCollapsed(viewId: Id, groupId: Id, collapsed: boolean): void;

  /**
   * Writes frames for groups that have none (016): `base` on the groups, `perView` into stored
   * views' `groupFrames`. Existing frames are kept. Untracked: never an undo step (research R2).
   */
  fillGroupFrames(
    base: ReadonlyMap<Id, Frame>,
    perView?: ReadonlyMap<Id, ReadonlyMap<Id, Frame>>,
  ): void;
  /**
   * Sets group frames in a view (016, R4): `group.position` / `group.size` in the base view,
   * `view.groupFrames` in others (the first write there copies the base frames, untracked).
   * Unknown groups are skipped; non-finite or non-positive values are `invalid`. Merges inside a
   * gesture or batch.
   */
  setGroupFrames(viewId: Id, frames: Readonly<Record<Id, Frame>>): void;
  /**
   * Pastes a clipboard fragment (016, R10) as one undo step: new ids, references remapped inside
   * the fragment, top-level nodes and groups into `parent`, unknown rule ids dropped, positions and
   * frames moved by `offset` (and written into a non-base `viewId` too). Returns the new ids in
   * fragment order. `missing-reference` for an unknown parent, `invalid` for a bad object.
   */
  pasteFragment(fragment: Fragment, options: PasteOptions): PastedIds;
  /**
   * Groups nodes and groups (016, R11) as one undo step: a new group titled `title` in `parent`,
   * with its base frame and per-view frames; the nodes' `group` and the groups' `parent` point to
   * it. Returns its id. `missing-reference` for unknown ids, `invalid` for a blank title or a
   * parent inside the selected groups.
   */
  groupSelection(selection: GroupSelection): Id;

  /**
   * Sets or clears (`null`) a card's stored size (017). Does not clamp: the schema only requires
   * positive `width` / `height`; the app clamps and reports out-of-range sizes as a problem. One
   * undo step, joining an open gesture.
   */
  setCardSize(nodeId: Id, size: Size | null): void;
  /**
   * Merges `patch` into an edge's stored route (017), or clears it entirely (`null`). A `null`
   * key removes it, `offset: 0` is dropped, and `route` itself is removed once no key is left. One
   * undo step, joining an open gesture.
   */
  setEdgeRoute(edgeId: Id, patch: EdgeRoutePatch | null): void;
  /**
   * Sets or clears (`value === null`) one style channel (`fill` or `stroke`) on every target node
   * and group as one undo step (020, R2). Unknown ids are skipped; empty targets do nothing.
   * `invalid` when `value` is not a valid `ColorRef`.
   */
  setStyle(targets: StyleTargets, channel: StyleChannel, value: string | null): void;
  /**
   * Adds a custom hex colour to the deck's swatches (020, R3): normalizes to lowercase
   * `#rrggbb`, is a no-op on a duplicate. `invalid` for a malformed hex or past the 12-colour cap.
   */
  addSwatch(hex: string): void;
  /**
   * Removes a custom hex colour from the deck's swatches (020, R3). Does nothing when absent;
   * never touches any node or group's stored `style`.
   */
  removeSwatch(hex: string): void;

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
  /**
   * Ends the open gesture (all nesting levels) and undoes it, leaving no undo or redo entry: the
   * undo and redo stacks are as before `beginGesture` (016, R14; Esc during a drag).
   * @throws Error when there is no open gesture.
   */
  cancelGesture(): void;
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
  // Second origin for view state that is saved and synced but never undone (collapse, preset
  // materialization; research R5). Registered as local, deliberately not in `trackedOrigins`.
  const untrackedOrigin = { editor: 'sododeck', untracked: true };
  editorOrigins.add(untrackedOrigin);

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

  // A gesture holds back the redo stack instead of clearing it (Yjs clears it on the first new
  // edit), so `cancelGesture` can put it back. The held items stay protected from garbage
  // collection until the gesture ends normally, when they are cleared for real (016, R14).
  type StackItem = (typeof undoManager.redoStack)[number];
  const clearStacks = undoManager.clear.bind(undoManager);
  let heldRedo: StackItem[] = [];
  let gestureUndoLength = 0;
  undoManager.clear = (clearUndoStack = true, clearRedoStack = true) => {
    if (gestureDepth > 0 && !clearUndoStack && clearRedoStack) {
      heldRedo = [...heldRedo, ...undoManager.redoStack];
      undoManager.redoStack = [];
      return;
    }
    clearStacks(clearUndoStack, clearRedoStack);
  };
  /** Clears these redo items for real (lets Yjs collect what they kept alive). */
  const dropRedo = (items: StackItem[]) => {
    if (items.length === 0) return;
    const current = undoManager.redoStack;
    undoManager.redoStack = items;
    clearStacks(false, true);
    undoManager.redoStack = current;
  };
  const closeGesture = () => {
    gestureDepth = 0;
    undoManager.captureTimeout = savedTimeout;
    undoManager.stopCapturing();
    lastKey = undefined;
  };

  // History-change notification (also used by the sticky draft, which can change availability
  // without a Yjs event: popping a stack item manually fires none).
  let lastAvailability = [undoManager.canUndo(), undoManager.canRedo()].join();
  const historyListeners = new Set<() => void>();
  const checkHistoryChange = () => {
    const now = [undoManager.canUndo(), undoManager.canRedo()].join();
    if (now !== lastAvailability) {
      lastAvailability = now;
      for (const listener of historyListeners) listener();
    }
  };
  for (const event of ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const) {
    undoManager.on(event, checkHistoryChange);
  }

  // Sticky draft (research R5, ADR 0010): a note created by a drop or "N" whose text edits merge
  // into one undo step "however long it takes", by keying on `stickies:<id>` and lifting the
  // capture timeout while the draft is open (see ops/stickies.ts). `draftStackLength` is the undo
  // stack's length just before the draft's own add, so ending the draft can tell whether its item
  // is still the only thing pushed since (nothing else merged into it or landed on top of it).
  let draftId: Id | null = null;
  let draftStackLength = 0;
  let draftSavedTimeout = undoManager.captureTimeout;

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
    transactUntracked: (fn) => {
      let result: ReturnType<typeof fn> | undefined;
      doc.transact(() => {
        result = fn();
      }, untrackedOrigin);
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
    attachRule: (host, ruleId) => {
      attachRule(ctx, host, ruleId);
    },
    detachRule: (host, ruleId) => {
      detachRule(ctx, host, ruleId);
    },
    setRuleInputs: (flowId, stepId, ruleId, values) => {
      setRuleInputs(ctx, flowId, stepId, ruleId, values);
    },
    beginStickyDraft: (data) => {
      if (draftId !== null) {
        throw new DeckEditError('invalid', [
          { path: '', message: 'A sticky draft is already open.' },
        ]);
      }
      draftStackLength = undoManager.undoStack.length;
      const id = addSticky(ctx, data);
      draftId = id;
      draftSavedTimeout = undoManager.captureTimeout;
      undoManager.captureTimeout = Infinity;
      checkHistoryChange();
      return id;
    },
    endStickyDraft: (id) => {
      if (draftId !== id) {
        throw new DeckEditError('invalid', [
          { path: '', message: 'No sticky draft is open for this note.' },
        ]);
      }
      const current = getObject(doc, 'stickies', id)?.text;
      const blank = current === undefined || current.trim() === '';
      if (blank) {
        if (current !== undefined) deleteStickyIfPresent(ctx, id);
        // Still exactly our item (nothing else merged in or landed on top): drop it, so the
        // draft leaves no undo or redo entry at all.
        if (undoManager.undoStack.length === draftStackLength + 1) {
          undoManager.undoStack.pop();
        }
      }
      undoManager.captureTimeout = draftSavedTimeout;
      undoManager.stopCapturing();
      lastKey = undefined;
      draftId = null;
      checkHistoryChange();
      return blank ? 'discarded' : 'kept';
    },
    pinSticky: (id, nodeId) => {
      pinSticky(ctx, id, nodeId);
    },
    unpinSticky: (id) => {
      unpinSticky(ctx, id);
    },
    moveSticky: (id, point) => {
      moveSticky(ctx, id, point);
    },
    moveInView: (viewId, positions) => {
      moveInView(ctx, viewId, positions);
    },
    setPinned: (viewId, nodeIds, pinned) => {
      setPinned(ctx, viewId, nodeIds, pinned);
    },
    updateView: (viewId, patch) => {
      updateView(ctx, viewId, patch);
    },
    addView: (data) => addView(ctx, data),
    removeView: (viewId) => removeView(ctx, viewId),
    setCollapsed: (viewId, groupId, collapsed) => {
      setCollapsed(ctx, viewId, groupId, collapsed);
    },
    fillGroupFrames: (base, perView) => {
      fillGroupFrames(ctx, base, perView);
    },
    setGroupFrames: (viewId, frames) => {
      setGroupFrames(ctx, viewId, frames);
    },
    pasteFragment: (fragment, options) => pasteFragment(ctx, fragment, options),
    groupSelection: (selection) => groupSelection(ctx, selection),
    setCardSize: (nodeId, size) => {
      setCardSize(ctx, nodeId, size);
    },
    setEdgeRoute: (edgeId, patch) => {
      setEdgeRoute(ctx, edgeId, patch);
    },
    setStyle: (targets, channel, value) => {
      setStyle(ctx, targets, channel, value);
    },
    addSwatch: (hex) => {
      addSwatch(ctx, hex);
    },
    removeSwatch: (hex) => {
      removeSwatch(ctx, hex);
    },
    batch: (fn) => ctx.transact(fn),
    beginGesture: () => {
      if (gestureDepth++ === 0) {
        undoManager.stopCapturing();
        savedTimeout = undoManager.captureTimeout;
        undoManager.captureTimeout = Infinity;
        gestureUndoLength = undoManager.undoStack.length;
        heldRedo = [];
      }
    },
    endGesture: () => {
      if (gestureDepth === 0) throw new Error('endGesture() called without beginGesture().');
      if (--gestureDepth === 0) {
        closeGesture();
        dropRedo(heldRedo);
        heldRedo = [];
      }
    },
    cancelGesture: () => {
      if (gestureDepth === 0) throw new Error('cancelGesture() called without beginGesture().');
      closeGesture();
      const undone: StackItem[] = [];
      while (undoManager.undoStack.length > gestureUndoLength) {
        undoManager.undo();
        const item = undoManager.redoStack.pop();
        if (item !== undefined) undone.push(item);
      }
      dropRedo(undone);
      undoManager.redoStack = heldRedo;
      heldRedo = [];
      checkHistoryChange();
    },
    undo: () => undoManager.undo() !== null,
    redo: () => undoManager.redo() !== null,
    canUndo: () => undoManager.canUndo(),
    canRedo: () => undoManager.canRedo(),
    onHistoryChange: (listener) => {
      historyListeners.add(listener);
      return () => {
        historyListeners.delete(listener);
      };
    },
    destroy: () => {
      for (const event of ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const) {
        undoManager.off(event, checkHistoryChange);
      }
      undoManager.destroy();
      ids.destroy();
      editorOrigins.delete(origin);
      editorOrigins.delete(untrackedOrigin);
    },
  };
}
