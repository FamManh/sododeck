/** Flow step operations. Steps are owned by their flow (data-model "References and delete cascade"). */
import type { Id, Step } from '@sododeck/schema';
import * as Y from 'yjs';

import { fromY, toY, type YObject } from '../convert';
import { collectionArray } from '../layout';
import { findIndexById, getMapById, type EditContext } from './context';
import { DeckEditError } from '../errors';
import { anchorableIds } from '../ids';
import { assertRefsExist, assertValid, validateObject } from '../validate';
import { assertFreeIds, inputColumnsOf, moveInArray } from './collections';
import { applyPatch, writePatch } from './patch';
import { stepRefs } from './refs';
import type { NewStep, Patch } from './types';

export function stepsOf(ctx: EditContext, flowId: Id): Y.Array<YObject> {
  const steps = getMapById(collectionArray(ctx.doc, 'flows'), flowId, 'Flow').get('steps');
  if (!(steps instanceof Y.Array)) throw new TypeError(`Flow "${flowId}" has no step list.`);
  return steps as Y.Array<YObject>;
}

function checkStepRefs(
  ctx: EditContext,
  step: Record<string, unknown>,
  fields?: readonly string[],
): void {
  const { doc } = ctx;
  const { refs, issues } = stepRefs(step, '', inputColumnsOf(doc));
  if (issues.length > 0) throw new DeckEditError('missing-reference', issues);
  const checked =
    fields === undefined ? refs : refs.filter((r) => fields.some((f) => r.path.startsWith(f)));
  assertRefsExist(doc, checked, () => anchorableIds(doc));
}

export function addStep(ctx: EditContext, flowId: Id, data: NewStep, index?: number): Id {
  const steps = stepsOf(ctx, flowId);
  const { id: explicitId, ...fields } = data;
  const id = explicitId ?? ctx.allocate('step');
  const step: Record<string, unknown> = { id, ...fields };
  assertValid(validateObject('step', step));
  if (explicitId !== undefined) assertFreeIds(ctx.doc, [{ path: 'id', id }]);
  checkStepRefs(ctx, step);

  const at =
    index === undefined ? steps.length : Math.max(0, Math.min(steps.length, Math.trunc(index)));
  ctx.transact(() => {
    steps.insert(at, [toY(step) as YObject]);
  });
  ctx.reserve([id]);
  return id;
}

export function updateStep(ctx: EditContext, flowId: Id, stepId: Id, patch: Patch<Step>): void {
  const steps = stepsOf(ctx, flowId);
  const map = getMapById(steps, stepId, 'Step');
  const { candidate, changed } = applyPatch(fromY(map) as Record<string, unknown>, patch, []);
  if (changed.length === 0) return;
  assertValid(validateObject('step', candidate));
  // Sample inputs depend on the step's rules, so a change to either re-checks both. Only changed
  // fields are checked, so a broken step (edge deleted) stays editable.
  const ruleFields = changed.includes('rules') || changed.includes('ruleInputs');
  checkStepRefs(
    ctx,
    ruleFields ? candidate : { edge: candidate.edge },
    ruleFields ? [...changed, 'rules'] : changed,
  );
  ctx.transact(() => {
    writePatch(map, candidate, changed);
  }, `flows:${flowId}:${stepId}`);
}

export function moveStep(ctx: EditContext, flowId: Id, stepId: Id, toIndex: number): void {
  const steps = stepsOf(ctx, flowId);
  moveInArray(ctx, steps, findIndexById(steps, stepId, 'Step'), toIndex);
}
