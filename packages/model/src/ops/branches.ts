/**
 * Flow branch operations (006, ADR 0008). A flow's `steps` stay one flat array in normal order:
 * main-path steps first, then each branch's steps grouped in `branches` order. The branch step is
 * derived (the last main-path step), so there is one branch point per flow and one level. Every op
 * here keeps the normal order and validates before it writes.
 */
import type { Branch, Id, SododeckFile, Step } from '@sododeck/schema';
import * as Y from 'yjs';

import { fromY, toY, type YObject, type YValue } from '../convert';
import { DeckEditError } from '../errors';
import { anchorableIds } from '../ids';
import { assertRefsExist, assertValid, validateObject } from '../validate';
import { findIndexById, getMapById, type EditContext } from './context';
import { applyPatch, writePatch } from './patch';
import { addStep, branchIdsOf, flowMapOf, pathRank, stepsOf } from './steps';
import type { NewStep, Patch } from './types';

declare const checkpointBrand: unique symbol;

/** Opaque restore point of one flow's structure (steps + branches), for edit-mode Cancel. */
export interface FlowCheckpoint {
  readonly flowId: Id;
  readonly [checkpointBrand]: true;
}

interface CheckpointData {
  readonly flowId: Id;
  readonly steps: readonly Step[];
  readonly branches: readonly Branch[] | undefined;
}

const invalid = (path: string, message: string) =>
  new DeckEditError('invalid', [{ path, message }]);

/** Index in `steps` where a new step at the end of path `branchId` goes, keeping normal order. */
function appendIndex(
  steps: Y.Array<YObject>,
  branchIds: readonly Id[],
  branchId: Id | null,
): number {
  const target = pathRank(branchId ?? undefined, branchIds);
  let at = 0;
  steps.toArray().forEach((s, i) => {
    if (pathRank(s.get('branch'), branchIds) <= target) at = i + 1;
  });
  return at;
}

/** Appends a step at the end of a path (main when `branchId` is null), keeping normal order. */
export function appendStep(ctx: EditContext, flowId: Id, branchId: Id | null, data: NewStep): Id {
  const branchIds = branchIdsOf(flowMapOf(ctx, flowId));
  if (branchId !== null && !branchIds.includes(branchId)) {
    throw new DeckEditError('missing-reference', [
      { path: 'branch', message: `"${branchId}" is not a branch of this flow.` },
    ]);
  }
  const { branch: _ignored, ...fields } = data;
  const step: NewStep = branchId === null ? fields : { ...fields, branch: branchId };
  return addStep(ctx, flowId, step, appendIndex(stepsOf(ctx, flowId), branchIds, branchId));
}

export function branchesArray(flow: YObject): Y.Array<YObject> | undefined {
  const branches = flow.get('branches');
  return branches instanceof Y.Array ? (branches as Y.Array<YObject>) : undefined;
}

/** The branch list of a flow that holds `branchId`, or throws `not-found`. */
export function branchListOf(ctx: EditContext, flowId: Id, branchId: Id): Y.Array<YObject> {
  const array = branchesArray(flowMapOf(ctx, flowId));
  if (array === undefined) {
    throw new DeckEditError('not-found', [
      { path: '', message: `Branch "${branchId}" does not exist.` },
    ]);
  }
  findIndexById(array, branchId, 'Branch');
  return array;
}

export interface NewBranch {
  label?: string;
  condition?: string;
  errorPath?: boolean;
  /** Edge of the branch's first step, recorded in the same undo step. */
  firstEdge?: Id;
}

/**
 * Adds a branch after main-path step `afterStepId` (FR-022, FR-030). When the flow has no branches
 * and main-path steps follow `afterStepId`, they first become alternative "a" (empty label and
 * condition), then the new branch is appended. With branches, only the branch step may take a new
 * branch. One transaction, one undo step.
 */
export function addBranch(
  ctx: EditContext,
  flowId: Id,
  afterStepId: Id,
  data: NewBranch,
): { branchId: Id; stepId: Id | null } {
  const flow = flowMapOf(ctx, flowId);
  const steps = stepsOf(ctx, flowId);
  const after = getMapById(steps, afterStepId, 'Step');
  if (after.get('branch') !== undefined) {
    throw invalid('afterStepId', 'Branches can only start from the main path.');
  }
  const mainIds = steps
    .toArray()
    .filter((s) => s.get('branch') === undefined)
    .map((s) => s.get('id') as Id);
  const position = mainIds.indexOf(afterStepId);
  const existing = branchIdsOf(flow);
  if (existing.length > 0 && position !== mainIds.length - 1) {
    throw invalid(
      'afterStepId',
      `This flow already branches after step ${String(mainIds.length)}.`,
    );
  }
  const following = existing.length === 0 ? mainIds.slice(position + 1) : [];

  const reserved = new Set<Id>();
  const allocate = (prefix: 'branch' | 'step') => {
    const id = ctx.allocate(prefix, reserved);
    reserved.add(id);
    return id;
  };
  const split: Branch | undefined =
    following.length > 0 ? { id: allocate('branch'), label: '', condition: '' } : undefined;
  const branch: Branch = {
    id: allocate('branch'),
    label: data.label ?? '',
    condition: data.condition ?? '',
    ...(data.errorPath === true ? { errorPath: true } : {}),
  };
  assertValid(validateObject('branch', branch));
  const first: Step | undefined =
    data.firstEdge === undefined
      ? undefined
      : { id: allocate('step'), edge: data.firstEdge, branch: branch.id };
  if (first !== undefined) {
    assertValid(validateObject('step', first));
    assertRefsExist(ctx.doc, [{ path: 'firstEdge', id: first.edge, target: 'edges' }], () =>
      anchorableIds(ctx.doc),
    );
  }

  ctx.transact(() => {
    let array = branchesArray(flow);
    if (array === undefined) {
      array = new Y.Array<YObject>();
      flow.set('branches', array as unknown as YValue);
    }
    for (const b of split === undefined ? [branch] : [split, branch]) {
      array.push([toY(b) as YObject]);
    }
    if (split !== undefined) {
      for (const s of steps) if (following.includes(s.get('id') as Id)) s.set('branch', split.id);
    }
    if (first !== undefined) {
      steps.insert(appendIndex(steps, branchIdsOf(flow), branch.id), [toY(first) as YObject]);
    }
  });
  ctx.reserve(reserved);
  return { branchId: branch.id, stepId: first?.id ?? null };
}

/** Changes a branch's label, condition, error-path flag or description (FR-028). */
export function updateBranch(
  ctx: EditContext,
  flowId: Id,
  branchId: Id,
  patch: Patch<Branch>,
): void {
  const map = getMapById(branchListOf(ctx, flowId, branchId), branchId, 'Branch');
  const { candidate, changed } = applyPatch(fromY(map) as Record<string, unknown>, patch, []);
  if (changed.length === 0) return;
  assertValid(validateObject('branch', candidate));
  ctx.transact(() => {
    writePatch(map, candidate, changed);
  }, `flows:${flowId}:branch:${branchId}`);
}

/** Pure. A frozen copy of a flow's steps and branches; hand it back to `restoreFlowStructure`. */
export function captureFlowStructure(file: SododeckFile, flowId: Id): FlowCheckpoint {
  const flow = file.flows.find((f) => f.id === flowId);
  if (flow === undefined) {
    throw new DeckEditError('not-found', [
      { path: '', message: `Flow "${flowId}" does not exist.` },
    ]);
  }
  const data: CheckpointData = {
    flowId,
    steps: structuredClone(flow.steps),
    branches: flow.branches === undefined ? undefined : structuredClone(flow.branches),
  };
  return Object.freeze(data) as unknown as FlowCheckpoint;
}

const structureOf = (steps: readonly Step[], branches: readonly Branch[] | undefined) =>
  JSON.stringify([
    steps.map((s) => [s.id, s.edge, s.branch ?? null]),
    (branches ?? []).map((b) => b.id),
  ]);

/** Pure. Whether the flow's structure (step order, edges, membership, branches) differs. */
export function flowStructureChanged(file: SododeckFile, checkpoint: FlowCheckpoint): boolean {
  const data = checkpoint as unknown as CheckpointData;
  const flow = file.flows.find((f) => f.id === data.flowId);
  if (flow === undefined) return true;
  return structureOf(flow.steps, flow.branches) !== structureOf(data.steps, data.branches);
}

/**
 * Restores a flow's steps and branches to `checkpoint` (clarification Q1): objects added since are
 * removed, removed ones come back, order and membership are restored, and objects that still
 * exist keep their current text fields. One transaction, one undo step.
 */
export function restoreFlowStructure(
  ctx: EditContext,
  flowId: Id,
  checkpoint: FlowCheckpoint,
): void {
  const data = checkpoint as unknown as CheckpointData;
  if (data.flowId !== flowId) {
    throw invalid('checkpoint', `The checkpoint belongs to flow "${data.flowId}".`);
  }
  const flow = flowMapOf(ctx, flowId);
  const steps = stepsOf(ctx, flowId);
  const current = fromY(flow) as { steps: Step[]; branches?: Branch[] };
  const currentSteps = new Map(current.steps.map((s) => [s.id, s]));
  const currentBranches = new Map((current.branches ?? []).map((b) => [b.id, b]));
  if (structureOf(current.steps, current.branches) === structureOf(data.steps, data.branches)) {
    return;
  }

  const restoredSteps = data.steps.map((saved): Step => {
    const now = currentSteps.get(saved.id);
    if (now === undefined) return structuredClone(saved);
    const { branch: _branch, ...text } = now;
    return {
      ...text,
      edge: saved.edge,
      ...(saved.branch === undefined ? {} : { branch: saved.branch }),
    };
  });
  const restoredBranches = data.branches?.map((saved): Branch =>
    structuredClone(currentBranches.get(saved.id) ?? saved),
  );

  ctx.transact(() => {
    steps.delete(0, steps.length);
    steps.insert(
      0,
      restoredSteps.map((s) => toY(s) as YObject),
    );
    if (restoredBranches === undefined) {
      flow.delete('branches');
    } else {
      flow.set('branches', toY(restoredBranches));
    }
  });
  ctx.reserve([...restoredSteps.map((s) => s.id), ...(restoredBranches ?? []).map((b) => b.id)]);
}
