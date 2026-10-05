/**
 * Deck-wide problems (feature 015, ADR 0013): duplicate connections, flow and
 * rule problems and broken references, gathered from the existing checks (`analyzeFlow`,
 * `ruleChecks`, `checkIntegrity`) plus three new ones. Pure and JSON-based so it runs in a worker.
 * Problems are derived for display and never stored in the deck (§g-23). 040 adds the database
 * schema's kept-but-broken references and mismatched composite keys (research R11).
 */
import {
  toPointer,
  type Edge,
  type Flow,
  type Id,
  type Node,
  type SododeckFile,
} from '@sododeck/schema';

import { drawnShapeType, isDbTable, isKnownPack, isKnownType, typeName } from './card-types';
import { validateValue } from './field-values';
import { appliesTo, findField } from './fields';
import { analyzeFlow, type FlowAnalysis, type PathStep } from './flow-paths';
import { stickyLabel } from './geometry';
import { checkSchema, isRelationship } from './db-lint';
import { endpointTitle } from './endpoint';
import { checkIntegrity, type IntegrityProblem } from './integrity';
import type { ObjectRef } from './layout';
import { ruleChecks } from './rules/evaluate';

export type ProblemKind =
  | 'duplicate-connection'
  | 'step-without-connection'
  | 'broken-chain'
  | 'incomplete-flow'
  | 'overlapping-conditions'
  | 'missing-rule'
  | 'rule-without-catch-all'
  | 'invalid-rule-cells'
  | 'broken-reference'
  | 'card-size-out-of-range'
  | 'unknown-card-type'
  | 'unknown-pack'
  | 'field-value-dangling'
  | 'db-dangling-reference'
  | 'db-composite-mismatch'
  | 'db-no-primary-key'
  | 'db-duplicate-table'
  | 'db-duplicate-column'
  | 'db-duplicate-index'
  | 'db-duplicate-enum'
  | 'db-empty-column'
  | 'db-type-mismatch'
  | 'db-null-default'
  | 'db-fk-not-key'
  | 'db-many-to-many'
  | 'db-empty-enum'
  | 'db-default-type'
  | 'db-required-loop'
  | 'db-duplicate-relationship'
  | 'db-unknown-type';

export type Severity = 'error' | 'warning';

/** Severity is a property of the kind (047 R1): one table to review. */
export const SEVERITY: Readonly<Record<ProblemKind, Severity>> = {
  'duplicate-connection': 'warning',
  'step-without-connection': 'error',
  'broken-chain': 'error',
  'incomplete-flow': 'warning',
  'overlapping-conditions': 'warning',
  'missing-rule': 'warning',
  'rule-without-catch-all': 'warning',
  'invalid-rule-cells': 'error',
  'broken-reference': 'error',
  'card-size-out-of-range': 'warning',
  'unknown-card-type': 'warning',
  'unknown-pack': 'warning',
  'field-value-dangling': 'warning',
  'db-dangling-reference': 'error',
  'db-composite-mismatch': 'error',
  'db-no-primary-key': 'warning',
  'db-duplicate-table': 'error',
  'db-duplicate-column': 'error',
  'db-duplicate-index': 'error',
  'db-duplicate-enum': 'error',
  'db-empty-column': 'error',
  'db-type-mismatch': 'error',
  'db-null-default': 'error',
  'db-fk-not-key': 'warning',
  'db-many-to-many': 'warning',
  'db-empty-enum': 'warning',
  'db-default-type': 'warning',
  'db-required-loop': 'warning',
  'db-duplicate-relationship': 'warning',
  'db-unknown-type': 'warning',
};

/** List order of the kinds (research R3). */
export const PROBLEM_KINDS: readonly ProblemKind[] = [
  'duplicate-connection',
  'step-without-connection',
  'broken-chain',
  'incomplete-flow',
  'overlapping-conditions',
  'missing-rule',
  'rule-without-catch-all',
  'invalid-rule-cells',
  'broken-reference',
  'card-size-out-of-range',
  'unknown-card-type',
  'unknown-pack',
  'field-value-dangling',
  'db-dangling-reference',
  'db-composite-mismatch',
  'db-no-primary-key',
  'db-duplicate-table',
  'db-duplicate-column',
  'db-duplicate-index',
  'db-duplicate-enum',
  'db-empty-column',
  'db-type-mismatch',
  'db-null-default',
  'db-fk-not-key',
  'db-many-to-many',
  'db-empty-enum',
  'db-default-type',
  'db-required-loop',
  'db-duplicate-relationship',
  'db-unknown-type',
];

/** Where a problem is fixed. */
export type ProblemTarget =
  | { type: 'node'; id: Id }
  | { type: 'nodes'; ids: readonly Id[] }
  | { type: 'edges'; ids: readonly Id[] }
  | { type: 'flow'; flowId: Id; stepId?: Id; branchIds?: readonly Id[] }
  | { type: 'rule'; ruleId: Id }
  /** The object holding a broken reference (group, view, sticky…). */
  | { type: 'object'; ref: ObjectRef };

export interface Problem {
  /** Stable across re-computation: kind plus the ids involved. */
  key: string;
  kind: ProblemKind;
  target: ProblemTarget;
  /** "Duplicate connection" */
  title: string;
  /** "Checkout → Orders appears twice" */
  detail: string;
  /** Sort key: the title of the main object. */
  objectTitle: string;
  /** Step position within a flow, else 0. */
  order: number;
  /** From `SEVERITY[kind]`, unless a draft overrides it. */
  severity: Severity;
  /** The faulty table row, when the problem is about one column (047). */
  column?: { tableId: Id; columnId: Id };
  /** One-click fixes the Problems panel and popover offer; the first is primary. */
  fixes?: readonly ProblemFix[];
  /** Short pill text for a relationship on the canvas: `int → uuid`, `n–n`, `not key`, `loop`. */
  short?: string;
  /** JSON Pointer to the main object of `target` in the file (062 R8): `/flows/1/steps/2`. */
  path: string;
  /** Id of that object (the first one for a multi-id target); absent for the deck itself. */
  subject?: Id;
}

/** What a `rename` fix edits. */
export type RenameTarget =
  | { type: 'table'; tableId: Id }
  | { type: 'column'; tableId: Id; columnId: Id }
  | { type: 'index'; tableId: Id; indexId: Id }
  | { type: 'enum'; enumId: Id };

export interface TypeChange {
  columnId: Id;
  type: string;
  size?: string;
}

/**
 * Fixes as plain data (047 R5), so `checkDeck` stays pure and JSON crosses the worker boundary.
 * The app applies them; `label` is the button text.
 */
export type ProblemFix = { label: string } & (
  | { kind: 'remove-value'; nodeId: Id; fieldId: Id }
  | { kind: 'make-pk'; tableId: Id; columnId: Id }
  | { kind: 'add-id-pk'; tableId: Id; type: string }
  /** Change the referencing columns of one table, one entry per mismatched pair (one batch). */
  | { kind: 'match-type'; tableId: Id; changes: readonly TypeChange[] }
  | { kind: 'create-junction'; edgeId: Id }
  | { kind: 'remove-default'; tableId: Id; columnId: Id }
  | { kind: 'allow-null'; tableId: Id; columnId: Id }
  | { kind: 'delete-edge'; edgeId: Id }
  | { kind: 'rename'; target: RenameTarget }
  | { kind: 'pick-column'; edgeId: Id }
  | { kind: 'add-values'; enumId: Id }
  | { kind: 'pick-type'; tableId: Id; columnId: Id }
);

export interface DeckProblems {
  /** Errors first, then kind, object title, step order, then key. */
  list: readonly Problem[];
  total: number;
  errors: number;
  warnings: number;
  /** Node, edge, flow and rule ids (and other holders) → their problems, for glyphs. */
  byObject: ReadonlyMap<Id, readonly Problem[]>;
}

/** Trimmed, lower-case, runs of whitespace collapsed: how labels and conditions are compared. */
function norm(text: string | undefined): string {
  return (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const times = (n: number) => (n === 2 ? 'twice' : `${String(n)} times`);

export interface Draft {
  kind: ProblemKind;
  ids: readonly Id[];
  target: ProblemTarget;
  title: string;
  detail: string;
  objectTitle: string;
  order?: number;
  /** Object ids to show the problem on (defaults to the target's ids). */
  on: readonly Id[];
  severity?: Severity;
  column?: { tableId: Id; columnId: Id };
  fixes?: readonly ProblemFix[];
  short?: string;
}

const TITLES: Record<ProblemKind, string> = {
  'duplicate-connection': 'Duplicate connection',
  'step-without-connection': 'Step without connection',
  'broken-chain': 'Broken flow',
  'incomplete-flow': 'Incomplete flow',
  'overlapping-conditions': 'Overlapping conditions',
  'missing-rule': 'Missing rule',
  'rule-without-catch-all': 'Rule without catch-all',
  'invalid-rule-cells': 'Invalid rule cells',
  'broken-reference': 'Broken reference',
  'card-size-out-of-range': 'Card size out of range',
  'unknown-card-type': 'Unknown card type',
  'unknown-pack': 'Unknown pack',
  'field-value-dangling': 'Value without a field',
  'db-dangling-reference': 'Missing column',
  'db-composite-mismatch': "Key columns don't match",
  'db-no-primary-key': 'No primary key',
  'db-duplicate-table': 'Duplicate table',
  'db-duplicate-column': 'Duplicate column',
  'db-duplicate-index': 'Duplicate index',
  'db-duplicate-enum': 'Duplicate enum',
  'db-empty-column': 'Column without a name',
  'db-type-mismatch': 'Type mismatch',
  'db-null-default': 'Null default on a not-null column',
  'db-fk-not-key': 'Reference to a non-key column',
  'db-many-to-many': 'Many-to-many',
  'db-empty-enum': 'Enum without values',
  'db-default-type': 'Default does not fit the type',
  'db-required-loop': 'Required references form a loop',
  'db-duplicate-relationship': 'Duplicate relationship',
  'db-unknown-type': 'Type not in the list',
};

/**
 * Sizes a card may have (017, research R11): drawn clamped to this range at every size outside
 * it, and reported here instead of a schema error. Keep in sync with the app's `CARD_SIZE_LIMITS`.
 */
const CARD_SIZE_RANGE = { min: { width: 120, height: 44 }, max: { width: 800, height: 600 } };

/** Every problem in `file`. Same input, same output and order. */
export function checkDeck(file: SododeckFile): DeckProblems {
  const drafts: Draft[] = [];
  const add: Add = (d) => drafts.push({ ...d, title: d.title ?? TITLES[d.kind] });

  const nodeById = new Map<Id, Node>(file.nodes.map((n) => [n.id, n]));
  const nodeTitle = (id: Id) => nodeById.get(id)?.title ?? id;
  // A connector end is a node or a group (050).
  const endTitle = (id: Id) => endpointTitle(file, id);

  checkDuplicates(file.edges, (edge) => isRelationship(edge, nodeById), endTitle, add);

  const analyses = new Map<Id, FlowAnalysis>();
  for (const flow of file.flows) {
    const analysis = analyzeFlow(flow, file.edges);
    analyses.set(flow.id, analysis);
    checkFlow(flow, analysis, add);
  }

  for (const [ruleId, rule] of Object.entries(file.rules)) {
    const { catchAll, invalidCells } = ruleChecks(rule);
    const on = [ruleId];
    const target: ProblemTarget = { type: 'rule', ruleId };
    if (!catchAll) {
      add({
        kind: 'rule-without-catch-all',
        ids: on,
        target,
        on,
        detail: `${rule.title} · some inputs match no row`,
        objectTitle: rule.title,
      });
    }
    if (invalidCells.length > 0) {
      const n = invalidCells.length;
      add({
        kind: 'invalid-rule-cells',
        ids: on,
        target,
        on,
        detail: `${rule.title} · ${String(n)} ${n === 1 ? "cell can't" : "cells can't"} be read`,
        objectTitle: rule.title,
      });
    }
  }

  checkReferences(file, analyses, nodeTitle, endTitle, add);
  checkCardSizes(file.nodes, add);
  checkCardTypes(file, add);
  checkFieldValues(file, add);
  checkDatabase(file, nodeById, add);
  checkSchema(file, nodeById, add);
  return finish(drafts, locator(file));
}

/** `title` overrides the kind's title when the id belongs in it (030: "Unknown pack x"). */
export type Add = (d: Omit<Draft, 'title'> & { title?: string }) => void;

/** A stored size outside the supported range (017, research R11); the file still opens. */
function checkCardSizes(nodes: readonly Node[], add: Add): void {
  const { max } = CARD_SIZE_RANGE;
  for (const node of nodes) {
    const size = node.size;
    if (size === undefined) continue;
    // A shape goes down to its own minimum (031 R1), a card to the card's.
    const min = drawnShapeType(node)?.minSize ?? CARD_SIZE_RANGE.min;
    if (size.width >= min.width && size.width <= max.width) {
      if (size.height >= min.height && size.height <= max.height) continue;
    }
    add({
      kind: 'card-size-out-of-range',
      ids: [node.id],
      target: { type: 'node', id: node.id },
      on: [node.id],
      detail:
        `${node.title} has a size of ${String(size.width)} × ${String(size.height)}; ` +
        `allowed ${String(min.width)} × ${String(min.height)} to ${String(max.width)} × ${String(max.height)}`,
      objectTitle: node.title,
    });
  }
}

/** Type and pack ids this version has no entry for (030): kept in the file, drawn generically. */
function checkCardTypes(file: SododeckFile, add: Add): void {
  const byType = new Map<string, Node[]>();
  for (const node of file.nodes) {
    if (isKnownType(node.type)) continue;
    const group = byType.get(node.type);
    if (group === undefined) byType.set(node.type, [node]);
    else group.push(node);
  }
  for (const [type, nodes] of byType) {
    const ids = nodes.map((n) => n.id);
    add({
      kind: 'unknown-card-type',
      ids,
      target: { type: 'nodes', ids },
      on: ids,
      title: `Unknown card type ${type}`,
      detail: `${nodes.map((n) => n.title).join(', ')} use a type this version does not know`,
      objectTitle: type,
    });
  }
  for (const pack of file.packs ?? []) {
    if (isKnownPack(pack)) continue;
    add({
      kind: 'unknown-pack',
      ids: [pack],
      target: { type: 'object', ref: { scope: 'meta', id: '' } },
      on: [],
      title: `Unknown pack ${pack}`,
      detail: 'Kept in the file; this version has no types for it',
      objectTitle: pack,
    });
  }
}

/**
 * Values the deck keeps but cannot show (032 FR-017): the field or the option is gone, the value
 * does not fit its field, or the field no longer applies to the card's type. One per card and field.
 */
function checkFieldValues(file: SododeckFile, add: Add): void {
  for (const node of file.nodes) {
    for (const [fieldId, value] of Object.entries(node.values ?? {})) {
      const field = findField(file, fieldId);
      let detail: string | undefined;
      if (field === undefined) {
        detail = `${node.title} holds a value for a field this deck no longer has (${fieldId})`;
      } else {
        const message = validateValue(field, value);
        const choice = field.kind === 'select' || field.kind === 'status';
        if (choice && typeof value === 'string' && message !== null) {
          detail = `${field.name} on ${node.title} points at an option that no longer exists`;
        } else if (message !== null) {
          detail = `${field.name} on ${node.title}: ${message}`;
        } else if (!appliesTo(field, node.type)) {
          detail = `${field.name} no longer applies to ${typeName(node.type)} cards (${node.title})`;
        }
      }
      if (detail === undefined) continue;
      add({
        kind: 'field-value-dangling',
        ids: [node.id, fieldId],
        target: { type: 'node', id: node.id },
        on: [node.id],
        detail,
        objectTitle: node.title,
        fixes: [{ kind: 'remove-value', nodeId: node.id, fieldId, label: 'Remove value' }],
      });
    }
  }
}

/**
 * Database schema references the deck keeps but that name nothing (040, research R11): an index
 * part or an `enumRef` of a table, a column end of a relationship whose end card is a table; and
 * composite ends of different lengths between two tables. Keys on other cards are ignored
 * (FR-018). Linear in columns: each table's column ids are collected once.
 */
function checkDatabase(file: SododeckFile, nodeById: ReadonlyMap<Id, Node>, add: Add): void {
  const enums = new Set((file.enums ?? []).map((e) => e.id));
  const columnsOf = new Map<Id, Set<Id>>();
  for (const node of file.nodes) {
    if (!isDbTable(node)) continue;
    const columns = new Set((node.columns ?? []).map((c) => c.id));
    columnsOf.set(node.id, columns);
    for (const column of node.columns ?? []) {
      if (column.enumRef === undefined || enums.has(column.enumRef)) continue;
      add({
        kind: 'db-dangling-reference',
        ids: [node.id, column.id, column.enumRef],
        target: { type: 'node', id: node.id },
        on: [node.id],
        title: 'Missing enum',
        detail: `${node.title}.${column.name} uses an enum this deck does not have (${column.enumRef})`,
        objectTitle: node.title,
      });
    }
    for (const index of node.indexes ?? []) {
      for (const part of index.columns) {
        if (typeof part !== 'string' || columns.has(part)) continue;
        add({
          kind: 'db-dangling-reference',
          ids: [node.id, index.id, part],
          target: { type: 'node', id: node.id },
          on: [node.id],
          detail: `${node.title} · index ${index.name ?? index.id} names a column the table does not have (${part})`,
          objectTitle: node.title,
        });
      }
    }
  }
  for (const edge of file.edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    const fromTitle = endpointTitle(file, edge.from);
    const route = `${fromTitle} → ${endpointTitle(file, edge.to)}`;
    for (const [side, ids, table] of [
      ['from', edge.fromColumns, from],
      ['to', edge.toColumns, to],
    ] as const) {
      const columns = table === undefined ? undefined : columnsOf.get(table.id);
      if (ids === undefined || table === undefined || columns === undefined) continue;
      for (const id of ids) {
        if (columns.has(id)) continue;
        add({
          kind: 'db-dangling-reference',
          ids: [edge.id, side, id],
          target: { type: 'edges', ids: [edge.id] },
          on: [edge.id, table.id],
          detail: `${route} · names a column ${table.title} does not have (${id})`,
          objectTitle: fromTitle,
        });
      }
    }
    const { fromColumns, toColumns } = edge;
    if (fromColumns === undefined || toColumns === undefined) continue;
    if (!columnsOf.has(edge.from) || !columnsOf.has(edge.to)) continue;
    if (fromColumns.length === toColumns.length) continue;
    add({
      kind: 'db-composite-mismatch',
      ids: [edge.id],
      target: { type: 'edges', ids: [edge.id] },
      on: [edge.id],
      detail: `${route} · ${String(fromColumns.length)} key columns on one end, ${String(toColumns.length)} on the other`,
      objectTitle: fromTitle,
    });
  }
}

function checkDuplicates(
  edges: readonly Edge[],
  isRelationship: (edge: Edge) => boolean,
  endTitle: (id: Id) => string,
  add: Add,
): void {
  const groups = new Map<string, Edge[]>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    // Relationships report as `db-duplicate-relationship`: one cause, one problem (047).
    if (isRelationship(edge)) continue;
    // Two relationships on different columns of the same tables are not copies (042 FR-012).
    const key = JSON.stringify([
      edge.from,
      edge.to,
      norm(edge.label),
      edge.fromColumns ?? null,
      edge.toColumns ?? null,
    ]);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [edge]);
    else group.push(edge);
  }
  for (const group of groups.values()) {
    const first = group[0];
    if (first === undefined || group.length < 2) continue;
    const ids = group.map((e) => e.id);
    const from = endTitle(first.from);
    add({
      kind: 'duplicate-connection',
      ids,
      target: { type: 'edges', ids },
      on: ids,
      detail: `${from} → ${endTitle(first.to)} appears ${times(group.length)}`,
      objectTitle: from,
    });
  }
}

/** Position of every step on its path, and the step before it (for "doesn't continue from"). */
function pathInfo(analysis: FlowAnalysis): Map<Id, { step: PathStep; previous: PathStep | null }> {
  const info = new Map<Id, { step: PathStep; previous: PathStep | null }>();
  const walk = (steps: readonly PathStep[], before: PathStep | null) => {
    let previous = before;
    for (const step of steps) {
      info.set(step.step.id, { step, previous });
      previous = step;
    }
  };
  walk(analysis.main, null);
  const fork = analysis.main.at(-1) ?? null;
  for (const branch of analysis.branches) walk(branch.steps, fork);
  return info;
}

function checkFlow(flow: Flow, analysis: FlowAnalysis, add: Add): void {
  const info = pathInfo(analysis);
  const order = new Map(flow.steps.map((s, i) => [s.id, i + 1]));
  const letters = new Map(analysis.branches.map((b) => [b.branch.id, b.letter]));
  const base = { on: [flow.id], objectTitle: flow.title };
  const stepTarget = (stepId: Id): ProblemTarget => ({ type: 'flow', flowId: flow.id, stepId });

  for (const p of analysis.problems) {
    switch (p.kind) {
      case 'broken-step': {
        const number = info.get(p.stepId)?.step.number ?? '?';
        add({
          ...base,
          kind: 'step-without-connection',
          ids: [flow.id, p.stepId],
          target: stepTarget(p.stepId),
          detail: `${flow.title} · step ${number} used a deleted connection`,
          order: order.get(p.stepId) ?? 0,
        });
        break;
      }
      case 'chain-break': {
        const at = info.get(p.stepId);
        const number = at?.step.number ?? '?';
        const previous = at?.previous?.number;
        add({
          ...base,
          kind: 'broken-chain',
          ids: [flow.id, p.stepId],
          target: stepTarget(p.stepId),
          detail:
            previous === undefined
              ? `${flow.title} · step ${number} doesn't continue the flow`
              : `${flow.title} · step ${number} doesn't continue from step ${previous}`,
          order: order.get(p.stepId) ?? 0,
        });
        break;
      }
      case 'empty-flow':
        add({
          ...base,
          kind: 'incomplete-flow',
          ids: [flow.id, 'empty'],
          target: { type: 'flow', flowId: flow.id },
          detail: `${flow.title} has no steps`,
        });
        break;
      case 'unknown-branch':
        add({
          ...base,
          kind: 'incomplete-flow',
          ids: [flow.id, p.stepId],
          target: { type: 'flow', flowId: flow.id },
          detail: `${flow.title} · a step belongs to a branch that no longer exists`,
          order: order.get(p.stepId) ?? 0,
        });
        break;
      case 'empty-branch-label':
      case 'empty-branch-condition': {
        const what = p.kind === 'empty-branch-label' ? 'label' : 'condition';
        add({
          ...base,
          kind: 'incomplete-flow',
          ids: [flow.id, p.branchId, what],
          target: { type: 'flow', flowId: flow.id, branchIds: [p.branchId] },
          detail: `${flow.title} · branch ${letters.get(p.branchId) ?? '?'} has no ${what}`,
          order: flow.steps.length + 1,
        });
        break;
      }
    }
  }

  const byCondition = new Map<string, Id[]>();
  for (const branch of flow.branches ?? []) {
    const condition = norm(branch.condition);
    if (condition === '') continue;
    const ids = byCondition.get(condition);
    if (ids === undefined) byCondition.set(condition, [branch.id]);
    else ids.push(branch.id);
  }
  for (const [condition, branchIds] of byCondition) {
    if (branchIds.length < 2) continue;
    const names = branchIds.map((id) => letters.get(id) ?? '?');
    const listed = `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
    add({
      ...base,
      kind: 'overlapping-conditions',
      ids: [flow.id, ...branchIds],
      target: { type: 'flow', flowId: flow.id, branchIds },
      detail: `${flow.title} · branches ${listed} both say "${condition}"`,
      order: flow.steps.length + 1,
    });
  }
}

function checkReferences(
  file: SododeckFile,
  analyses: ReadonlyMap<Id, FlowAnalysis>,
  nodeTitle: (id: Id) => string,
  endTitle: (id: Id) => string,
  add: Add,
): void {
  const byId = <T extends { id: Id }>(items: readonly T[]) => new Map(items.map((i) => [i.id, i]));
  const groups = byId(file.groups);
  const edges = byId(file.edges);
  const views = byId(file.views);
  const flows = byId(file.flows);
  const stickies = byId(file.stickies);
  const images = byId(file.images ?? []);

  const stepNumber = (flowId: Id, stepId: Id) =>
    analyses.get(flowId)?.byStepId.get(stepId)?.number ??
    String((flows.get(flowId)?.steps.findIndex((s) => s.id === stepId) ?? -1) + 1);

  /** Label, sort title, target and glyph ids of the object holding a reference. */
  const holder = (
    ref: ObjectRef,
  ): { label: string; title: string; target: ProblemTarget; on: Id[] } => {
    switch (ref.scope) {
      case 'nodes': {
        const title = nodeTitle(ref.id);
        return { label: title, title, target: { type: 'node', id: ref.id }, on: [ref.id] };
      }
      case 'edges': {
        const e = edges.get(ref.id);
        const label = e ? `Connection ${endTitle(e.from)} → ${endTitle(e.to)}` : ref.id;
        return { label, title: label, target: { type: 'edges', ids: [ref.id] }, on: [ref.id] };
      }
      case 'flows': {
        const title = flows.get(ref.id)?.title ?? ref.id;
        const stepId = ref.child?.kind === 'step' ? ref.child.id : undefined;
        return {
          label: stepId === undefined ? title : `${title} · step ${stepNumber(ref.id, stepId)}`,
          title,
          target: { type: 'flow', flowId: ref.id, ...(stepId === undefined ? {} : { stepId }) },
          on: [ref.id],
        };
      }
      case 'groups': {
        const title = groups.get(ref.id)?.title ?? ref.id;
        return { label: `Group "${title}"`, title, target: { type: 'object', ref }, on: [ref.id] };
      }
      case 'views': {
        const title = views.get(ref.id)?.title ?? ref.id;
        return { label: `View "${title}"`, title, target: { type: 'object', ref }, on: [ref.id] };
      }
      case 'stickies': {
        const title = stickyLabel(stickies.get(ref.id)?.text ?? '') ?? 'Untitled note';
        return { label: `Sticky "${title}"`, title, target: { type: 'object', ref }, on: [ref.id] };
      }
      case 'images': {
        const title = images.get(ref.id)?.alt ?? 'Image';
        return { label: `Image "${title}"`, title, target: { type: 'object', ref }, on: [ref.id] };
      }
      default:
        return { label: ref.id, title: ref.id, target: { type: 'object', ref }, on: [ref.id] };
    }
  };

  for (const p of checkIntegrity(file)) {
    // Reported by analyzeFlow as step-without-connection / incomplete-flow (research R2).
    if (p.object.scope === 'flows' && (p.field === 'edge' || p.field === 'branch')) continue;
    const h = holder(p.object);
    const ids = [p.object.scope, p.object.id, p.object.child?.id ?? '', p.field, p.target];
    const order =
      p.object.scope === 'flows' && p.object.child?.kind === 'step'
        ? (flows.get(p.object.id)?.steps.findIndex((s) => s.id === p.object.child?.id) ?? -1) + 1
        : 0;
    if (p.kind === 'missing-reference' && p.field === 'rules' && p.targetType === 'rule') {
      add({
        kind: 'missing-rule',
        ids,
        target: h.target,
        on: h.on,
        detail: `${h.label} uses a rule that was deleted`,
        objectTitle: h.title,
        order,
      });
      continue;
    }
    add({
      kind: 'broken-reference',
      ids,
      target: h.target,
      on: h.on,
      detail: referenceDetail(p, h.label),
      objectTitle: h.title,
      order,
    });
  }
}

function referenceDetail(p: IntegrityProblem, label: string): string {
  switch (p.kind) {
    case 'cycle':
      return `${label} is inside itself`;
    case 'ambiguous-anchor':
      return `${label} is attached to an id used by several objects`;
    case 'detached-rule-input':
      return `${label} has inputs for a rule it doesn't use`;
    case 'duplicate-id':
      return `${label} has the same id as ${p.targetType === 'group' ? 'a group' : p.targetType === 'sticky' ? 'a note' : 'a card'}`;
    case 'missing-reference': {
      if (p.targetType === 'asset') return `${label} uses a picture the deck does not hold`;
      const what = p.targetType === 'object' ? 'something' : `a ${p.targetType.replace('-', ' ')}`;
      return `${label} points to ${what} that was deleted`;
    }
  }
}

function targetIds(target: ProblemTarget): readonly Id[] {
  switch (target.type) {
    case 'node':
      return [target.id];
    case 'nodes':
      return target.ids;
    case 'edges':
      return target.ids;
    case 'flow':
      return [target.flowId];
    case 'rule':
      return [target.ruleId];
    case 'object':
      return [target.ref.id];
  }
}

type Segments = (string | number)[];

/** First index of every id in a list. Built on first use: a deck without problems builds none. */
function indexer(items: () => readonly { id: Id }[] | undefined) {
  let map: Map<Id, number> | undefined;
  return (id: Id): number | undefined => {
    if (map === undefined) {
      map = new Map();
      (items() ?? []).forEach((item, i) => {
        if (map?.has(item.id) === false) map.set(item.id, i);
      });
    }
    return map.get(id);
  };
}

/** Where a problem sits in the file: a JSON Pointer and the id of the object there (062 R8). */
type Locate = (draft: Draft) => { path: string; subject?: Id };

function locator(file: SododeckFile): Locate {
  const collections = {
    nodes: indexer(() => file.nodes),
    groups: indexer(() => file.groups),
    edges: indexer(() => file.edges),
    views: indexer(() => file.views),
    features: indexer(() => file.features),
    flows: indexer(() => file.flows),
    stickies: indexer(() => file.stickies),
    images: indexer(() => file.images),
  };
  const enums = indexer(() => file.enums);
  const children = new Map<string, (id: Id) => number | undefined>();
  /** Index of a child (`steps`, `columns`…) of the item at `index` of `list`. */
  const childIndex = (list: string, index: number, key: string, id: Id) => {
    const cacheKey = `${list}/${String(index)}/${key}`;
    let find = children.get(cacheKey);
    if (find === undefined) {
      const owner = (file as unknown as Record<string, unknown[] | undefined>)[list]?.[index];
      const items = (owner as Record<string, { id: Id }[] | undefined> | undefined)?.[key];
      find = indexer(() => items);
      children.set(cacheKey, find);
    }
    return find(id);
  };
  /** `[list, index]` and, when found, `[key, childIndex]`; stops where an id is not found. */
  const at = (list: keyof typeof collections, id: Id, key?: string, childId?: Id): Segments => {
    const index = collections[list](id);
    if (index === undefined) return [list];
    if (key === undefined || childId === undefined) return [list, index];
    const child = childIndex(list, index, key, childId);
    return child === undefined ? [list, index] : [list, index, key, child];
  };
  const CHILD_KEYS: Partial<Record<string, string>> = {
    step: 'steps',
    branch: 'branches',
    column: 'columns',
    index: 'indexes',
    check: 'checks',
  };

  return (draft) => {
    const { target } = draft;
    let segments: Segments;
    let subject: Id | undefined;
    switch (target.type) {
      case 'node':
        if (draft.column !== undefined && draft.column.tableId === target.id) {
          segments = at('nodes', target.id, 'columns', draft.column.columnId);
          subject = draft.column.columnId;
        } else {
          segments = at('nodes', target.id);
          subject = target.id;
        }
        break;
      case 'nodes':
      case 'edges': {
        subject = target.ids[0];
        segments = subject === undefined ? [target.type] : at(target.type, subject);
        break;
      }
      case 'flow':
        if (target.stepId !== undefined) {
          segments = at('flows', target.flowId, 'steps', target.stepId);
          subject = target.stepId;
        } else if (target.branchIds?.[0] !== undefined) {
          subject = target.branchIds[0];
          segments = at('flows', target.flowId, 'branches', subject);
        } else {
          segments = at('flows', target.flowId);
          subject = target.flowId;
        }
        break;
      case 'rule':
        segments = ['rules', target.ruleId];
        subject = target.ruleId;
        break;
      case 'object': {
        const { ref } = target;
        if (ref.scope === 'meta') {
          if (draft.kind === 'unknown-pack') {
            const pack = draft.ids[0] ?? '';
            const index = file.packs?.indexOf(pack) ?? -1;
            segments = index === -1 ? ['packs'] : ['packs', index];
          } else if (ref.child?.kind === 'enum' || ref.child?.kind === 'enum-value') {
            const index = enums(ref.id);
            segments = index === undefined ? ['enums'] : ['enums', index];
            subject = ref.id;
          } else {
            segments = [];
          }
        } else if (ref.scope === 'rules') {
          segments = ['rules', ref.id];
          subject = ref.id;
        } else {
          const key = ref.child === undefined ? undefined : CHILD_KEYS[ref.child.kind];
          segments = at(ref.scope, ref.id, key, ref.child?.id);
          subject = ref.child?.id ?? ref.id;
        }
        break;
      }
    }
    return { path: toPointer(segments), ...(subject === undefined ? {} : { subject }) };
  };
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1 };
const KIND_RANK = new Map(PROBLEM_KINDS.map((k, i) => [k, i]));

function finish(drafts: readonly Draft[], locate: Locate): DeckProblems {
  const seen = new Set<string>();
  const list: Problem[] = [];
  for (const d of drafts) {
    const key = `${d.kind}:${d.ids.join(':')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      key,
      kind: d.kind,
      target: d.target,
      title: d.title,
      detail: d.detail,
      objectTitle: d.objectTitle,
      order: d.order ?? 0,
      severity: d.severity ?? SEVERITY[d.kind],
      ...(d.column === undefined ? {} : { column: d.column }),
      ...(d.fixes === undefined ? {} : { fixes: d.fixes }),
      ...(d.short === undefined ? {} : { short: d.short }),
      ...locate(d),
    });
  }
  const on = new Map(drafts.map((d) => [`${d.kind}:${d.ids.join(':')}`, d.on]));
  list.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      (KIND_RANK.get(a.kind) ?? 0) - (KIND_RANK.get(b.kind) ?? 0) ||
      a.objectTitle.localeCompare(b.objectTitle, undefined, { sensitivity: 'base' }) ||
      a.order - b.order ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  const byObject = new Map<Id, Problem[]>();
  for (const problem of list) {
    for (const id of new Set([...(on.get(problem.key) ?? []), ...targetIds(problem.target)])) {
      const bucket = byObject.get(id);
      if (bucket === undefined) byObject.set(id, [problem]);
      else bucket.push(problem);
    }
  }
  const errors = list.filter((p) => p.severity === 'error').length;
  return { list, total: list.length, errors, warnings: list.length - errors, byObject };
}
