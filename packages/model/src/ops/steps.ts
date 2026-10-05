/** Flow step operations. Steps are owned by their flow (data-model "References and delete cascade"). */
import type { Id, Step } from '@sododeck/schema';

import type { YObject } from '../convert';
import {
  childList,
  collectionMap,
  insertAt,
  orderedEntries,
  orderedIds,
  planMove,
  type ListMap,
} from '../layout';
import { readObject } from '../read';
import { createObject, writeFields } from '../write';
import { requireEntry, type EditContext } from './context';
import { DeckEditError } from '../errors';
import { assertRefsExist, assertValid, validateObject } from '../validate';
import { assertFreeIds, inputColumnsOf } from './collections';
import { applyPatch } from './patch';
import { stepBranchIssues, stepRefs } from './refs';
import type { NewStep, Patch } from './types';

export function flowMapOf(ctx: EditContext, flowId: Id): YObject {
  return requireEntry(collectionMap(ctx.doc, 'flows'), flowId, 'Flow');
}

/** A flow's steps: one flat order across all paths, as the file's array (research R4). */
export function stepsOf(ctx: EditContext, flowId: Id): ListMap {
  const steps = childList(flowMapOf(ctx, flowId), 'steps');
  if (steps === undefined) throw new TypeError(`Flow "${flowId}" has no step list.`);
  return steps;
}

/** Ids of a flow's branches, in order (empty when it has none). */
export function branchIdsOf(flow: YObject): Id[] {
  const branches = childList(flow, 'branches');
  return branches === undefined ? [] : orderedIds(branches);
}

function checkStepRefs(
  ctx: EditContext,
  flowId: Id,
  step: Record<string, unknown>,
  fields?: readonly string[],
): void {
  const { doc } = ctx;
  const { refs, issues } = stepRefs(step, '', inputColumnsOf(doc));
  if (fields === undefined || fields.includes('branch')) {
    issues.push(...stepBranchIssues(step, '', new Set(branchIdsOf(flowMapOf(ctx, flowId)))));
  }
  if (issues.length > 0) throw new DeckEditError('missing-reference', issues);
  const checked =
    fields === undefined ? refs : refs.filter((r) => fields.some((f) => r.path.startsWith(f)));
  assertRefsExist(doc, checked);
}

export function addStep(ctx: EditContext, flowId: Id, data: NewStep, index?: number): Id {
  const steps = stepsOf(ctx, flowId);
  const { id: explicitId, ...fields } = data;
  const id = explicitId ?? ctx.allocate('step');
  const step: Record<string, unknown> = { id, ...fields };
  assertValid(validateObject('step', step));
  if (explicitId !== undefined) assertFreeIds(ctx.doc, [{ path: 'id', id }]);
  checkStepRefs(ctx, flowId, step);

  ctx.transact(() => {
    insertAt(steps, id, createObject('step', step, ''), index);
  });
  ctx.reserve([id]);
  return id;
}

export function updateStep(ctx: EditContext, flowId: Id, stepId: Id, patch: Patch<Step>): void {
  const steps = stepsOf(ctx, flowId);
  const map = requireEntry(steps, stepId, 'Step');
  const { candidate, changed } = applyPatch(readObject('step', stepId, map), patch, []);
  if (changed.length === 0) return;
  assertValid(validateObject('step', candidate));
  // Sample inputs depend on the step's rules, so a change to either re-checks both. Only changed
  // fields are checked, so a broken step (edge deleted) stays editable.
  const ruleFields = changed.includes('rules') || changed.includes('ruleInputs');
  checkStepRefs(
    ctx,
    flowId,
    ruleFields ? candidate : { edge: candidate.edge, branch: candidate.branch },
    ruleFields ? [...changed, 'rules'] : changed,
  );
  ctx.transact(() => {
    writeFields(map, 'step', candidate, changed);
  }, `flows:${flowId}:${stepId}`);
}

/**
 * Rank of a step in the normal order (ADR 0008): main path 0, branch i → i + 1, a step naming no
 * branch of the flow last.
 */
export function pathRank(branch: unknown, branchIds: readonly Id[]): number {
  if (branch === undefined) return 0;
  const index = typeof branch === 'string' ? branchIds.indexOf(branch) : -1;
  return index === -1 ? branchIds.length + 1 : index + 1;
}

const isNormal = (ranks: readonly number[]) =>
  ranks.every((r, i) => i === 0 || r >= (ranks[i - 1] ?? 0));

/**
 * Moves a step to `toIndex` in `flow.steps`. Refused (`invalid`) when the move would leave the
 * step's path (clarification Q4), or would put a main-path step after the branch step while the
 * flow has branches (the fork stays the last main-path step).
 */
export function moveStep(ctx: EditContext, flowId: Id, stepId: Id, toIndex: number): void {
  const flow = flowMapOf(ctx, flowId);
  const steps = stepsOf(ctx, flowId);
  requireEntry(steps, stepId, 'Step');
  const entries = orderedEntries(steps);
  const from = entries.findIndex(([id]) => id === stepId);
  const to = Math.max(0, Math.min(entries.length - 1, Math.trunc(toIndex)));
  const branchIds = branchIdsOf(flow);
  const before = entries.map(([id, s]) => ({ id, branch: s.get('branch') }));
  const after = [...before];
  const [moved] = after.splice(from, 1);
  if (moved === undefined) return;
  after.splice(to, 0, moved);

  const refuse = (message: string) => {
    throw new DeckEditError('invalid', [{ path: 'steps', message }]);
  };
  const ranks = (list: typeof before) => list.map((s) => pathRank(s.branch, branchIds));
  if (isNormal(ranks(before)) && !isNormal(ranks(after))) {
    refuse('Steps can only move within their own path.');
  }
  if (branchIds.length > 0 && moved.branch === undefined) {
    const lastMain = (list: typeof before) => list.filter((s) => s.branch === undefined).at(-1)?.id;
    if (lastMain(before) !== lastMain(after)) {
      refuse('The branch step stays the last step of the main path.');
    }
  }
  const move = planMove(steps, stepId, to);
  if (move !== undefined) ctx.transact(move);
}
