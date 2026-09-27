/**
 * Attaching rules to nodes and steps, and a step's sample inputs (008 research R10). These ops
 * keep the invariant that `step.ruleInputs` only holds attached rules and their input columns,
 * so callers never patch `rules` and `ruleInputs` by hand.
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import { fromY, isRecord, jsonEqual, toY, type YObject } from '../convert';
import { DeckEditError } from '../errors';
import { collectionArray, rulesMap } from '../layout';
import { inputColumnsOf } from './collections';
import { getMapById, type EditContext } from './context';
import { stepsOf } from './steps';

/** What a rule attaches to: a component, or a step of a flow. */
export type RuleHost = { kind: 'node'; id: Id } | { kind: 'step'; flowId: Id; stepId: Id };

function hostMap(ctx: EditContext, host: RuleHost): YObject {
  return host.kind === 'node'
    ? getMapById(collectionArray(ctx.doc, 'nodes'), host.id, 'Component')
    : getMapById(stepsOf(ctx, host.flowId), host.stepId, 'Step');
}

function rulesOf(map: YObject): Id[] {
  const rules = map.get('rules');
  return rules instanceof Y.Array
    ? rules.toArray().filter((id): id is Id => typeof id === 'string')
    : [];
}

/** Appends `ruleId` to the host's rules. One undo step of its own. */
export function attachRule(ctx: EditContext, host: RuleHost, ruleId: Id): void {
  const map = hostMap(ctx, host);
  if (!rulesMap(ctx.doc).has(ruleId)) {
    throw new DeckEditError('missing-reference', [
      { path: 'rules', message: `Rule "${ruleId}" does not exist.` },
    ]);
  }
  if (rulesOf(map).includes(ruleId)) {
    throw new DeckEditError('invalid', [
      { path: 'rules', message: `Rule "${ruleId}" is already attached.` },
    ]);
  }
  ctx.transact(() => {
    const rules = map.get('rules');
    if (rules instanceof Y.Array) rules.push([ruleId]);
    else map.set('rules', toY([ruleId]));
  });
}

/**
 * Removes `ruleId` from the host's rules (the field goes when empty). On a step its sample inputs
 * for that rule go in the same transaction. No-op when the rule is not attached.
 */
export function detachRule(ctx: EditContext, host: RuleHost, ruleId: Id): void {
  const map = hostMap(ctx, host);
  const rules = map.get('rules');
  if (!(rules instanceof Y.Array) || !rulesOf(map).includes(ruleId)) return;
  ctx.transact(() => {
    for (let i = rules.length - 1; i >= 0; i--) if (rules.get(i) === ruleId) rules.delete(i, 1);
    if (rules.length === 0) map.delete('rules');
    const inputs = map.get('ruleInputs');
    if (inputs instanceof Y.Map && inputs.has(ruleId)) {
      inputs.delete(ruleId);
      if (inputs.size === 0) map.delete('ruleInputs');
    }
  });
}

/**
 * Replaces a step's sample inputs for one attached rule. Empty values are dropped and the rule's
 * key goes when nothing is left. Keyed per step and rule, so a typing burst is one undo step.
 */
export function setRuleInputs(
  ctx: EditContext,
  flowId: Id,
  stepId: Id,
  ruleId: Id,
  values: Readonly<Record<Id, string>>,
): void {
  const step = getMapById(stepsOf(ctx, flowId), stepId, 'Step');
  if (!rulesOf(step).includes(ruleId)) {
    throw new DeckEditError('missing-reference', [
      { path: `ruleInputs.${ruleId}`, message: `Rule "${ruleId}" is not attached to this step.` },
    ]);
  }
  const columns = inputColumnsOf(ctx.doc)(ruleId) ?? new Set<Id>();
  const next: Record<Id, string> = {};
  for (const [columnId, value] of Object.entries(values)) {
    if (!columns.has(columnId)) {
      throw new DeckEditError('missing-reference', [
        {
          path: `ruleInputs.${ruleId}.${columnId}`,
          message: `"${columnId}" is not an input column of rule "${ruleId}".`,
        },
      ]);
    }
    if (value !== '') next[columnId] = value;
  }

  const all = step.get('ruleInputs');
  const current = all instanceof Y.Map ? fromY(all.get(ruleId)) : undefined;
  if (jsonEqual(isRecord(current) ? current : {}, next)) return;

  ctx.transact(() => {
    const inputs = step.get('ruleInputs');
    if (Object.keys(next).length === 0) {
      if (inputs instanceof Y.Map) {
        inputs.delete(ruleId);
        if (inputs.size === 0) step.delete('ruleInputs');
      }
      return;
    }
    const inner = inputs instanceof Y.Map ? inputs.get(ruleId) : undefined;
    if (!(inputs instanceof Y.Map)) {
      step.set('ruleInputs', toY({ [ruleId]: next }));
    } else if (!(inner instanceof Y.Map)) {
      inputs.set(ruleId, toY(next));
    } else {
      // Per-key writes, so two tabs typing in different columns merge.
      for (const key of [...inner.keys()]) if (!(key in next)) inner.delete(key);
      for (const [key, value] of Object.entries(next)) {
        if (inner.get(key) !== value) inner.set(key, value);
      }
    }
  }, `flows:${flowId}:${stepId}:inputs:${ruleId}`);
}
