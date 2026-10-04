/**
 * Validation of edits before they are written (research R4). Yjs transactions cannot roll back,
 * so every operation builds its candidate plain object, checks it here, and only then writes.
 * Validity comes from the generated Zod in @sododeck/schema; nothing is redefined here.
 */
import {
  checkSemanticRules,
  emptySododeckFile,
  sododeckFileSchema,
  type Id,
  type Issue,
  type SododeckFile,
} from '@sododeck/schema';
import { isRecord } from './convert';
import { collectionMap, rulesMap, type Collection, type DeckDoc } from './layout';
import { DeckEditError } from './errors';

/** The part of a Zod schema used here, so this package needs no direct zod dependency. */
interface Schema {
  safeParse(
    value: unknown,
  ):
    | { success: true }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

const shape = sododeckFileSchema.shape;

const ELEMENT_SCHEMAS = {
  nodes: shape.nodes.element,
  groups: shape.groups.element,
  edges: shape.edges.element,
  views: shape.views.element,
  features: shape.features.element,
  flows: shape.flows.element,
  stickies: shape.stickies.element,
  step: shape.flows.element.shape.steps.element,
  branch: shape.flows.element.shape.branches.unwrap().element,
  rule: shape.rules.valueType,
  column: shape.rules.valueType.shape.inputs.element,
  row: shape.rules.valueType.shape.rows.element,
  meta: sododeckFileSchema
    .pick({
      name: true,
      description: true,
      tags: true,
      swatches: true,
      tagColors: true,
      packs: true,
      dialect: true,
      tableDisplay: true,
    })
    .strict(),
  field: shape.fields.unwrap().element,
  style: shape.nodes.element.shape.style.unwrap(),
  edgeStyle: shape.edges.element.shape.style.unwrap(),
  dbColumn: shape.nodes.element.shape.columns.unwrap().element,
  dbIndex: shape.nodes.element.shape.indexes.unwrap().element,
  dbCheck: shape.nodes.element.shape.checks.unwrap().element,
  enum: shape.enums.unwrap().element,
  enumValue: shape.enums.unwrap().element.shape.values.element,
} satisfies Record<
  | Collection
  | 'step'
  | 'branch'
  | 'rule'
  | 'column'
  | 'row'
  | 'meta'
  | 'field'
  | 'style'
  | 'edgeStyle'
  | 'dbColumn'
  | 'dbIndex'
  | 'dbCheck'
  | 'enum'
  | 'enumValue',
  Schema
>;

export type ValidationKind = keyof typeof ELEMENT_SCHEMAS;

function zodIssues(issues: { path: PropertyKey[]; message: string }[]): Issue[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** A one-object file, so the schema's semantic checks (S1–S3) run on just that object. */
function fileWith(kind: ValidationKind, candidate: unknown): SododeckFile | undefined {
  const file = emptySododeckFile();
  switch (kind) {
    case 'views': {
      // S5 needs the groups `groupFrames` names; whether they exist is the model's job (the
      // cascade and the integrity report), not a format check of one view.
      const frames = isRecord(candidate) ? candidate.groupFrames : undefined;
      const groups = isRecord(frames) ? Object.keys(frames).map((id) => ({ id, title: id })) : [];
      return { ...file, groups, views: [candidate] } as SododeckFile;
    }
    case 'groups':
    case 'edges':
    case 'flows':
    case 'stickies':
      return { ...file, [kind]: [candidate] };
    case 'step':
      return { ...file, flows: [{ id: 'f', title: 'f', steps: [candidate] }] } as SododeckFile;
    case 'field':
      // S12 on one definition: built-in kinds, unit and options placement, option ids, icons.
      return { ...file, fields: [candidate] } as SododeckFile;
    default:
      return undefined;
  }
}

/** Format issues of one candidate object (structure, then the semantic rules that apply). */
export function validateObject(kind: ValidationKind, candidate: unknown): Issue[] {
  const result = (ELEMENT_SCHEMAS[kind] as Schema).safeParse(candidate);
  if (!result.success) return zodIssues(result.error.issues);
  if (kind === 'dbColumn') {
    // S14 (040) on one column, inside a one-table file; paths name the column's own keys.
    const file = {
      ...emptySododeckFile(),
      nodes: [{ id: 't', type: 'db-table', title: 't', columns: [candidate] }],
    } as SododeckFile;
    const prefix = 'nodes.0.columns.0.';
    return checkSemanticRules(file).map((issue) => ({
      ...issue,
      path: issue.path.startsWith(prefix) ? issue.path.slice(prefix.length) : issue.path,
    }));
  }
  const file = fileWith(kind, candidate);
  return file === undefined ? [] : checkSemanticRules(file);
}

/** Format issues of a rule, including one cell per column in every row (S1). */
export function validateRule(id: Id, rule: unknown): Issue[] {
  const issues = validateObject('rule', rule);
  if (issues.length > 0) return issues;
  return checkSemanticRules({ ...emptySododeckFile(), rules: { [id]: rule } } as SododeckFile);
}

/** Throws `DeckEditError('invalid')` when there are issues. */
export function assertValid(issues: Issue[]): void {
  if (issues.length > 0) throw new DeckEditError('invalid', issues);
}

/** `'nodes|groups'`: a connector end, which names a node or a group (050). */
export type RefTarget = Collection | 'nodes|groups' | 'rule' | 'any';

export interface Ref {
  /** Field holding the reference, e.g. `from` or `includes.2`. */
  path: string;
  id: Id;
  target: RefTarget;
}

function exists(doc: DeckDoc, ref: Ref, anyIds: () => ReadonlySet<Id>): boolean {
  switch (ref.target) {
    case 'rule':
      return rulesMap(doc).has(ref.id);
    case 'any':
      return anyIds().has(ref.id);
    case 'nodes|groups':
      return collectionMap(doc, 'nodes').has(ref.id) || collectionMap(doc, 'groups').has(ref.id);
    default:
      return collectionMap(doc, ref.target).has(ref.id);
  }
}

const targetName = (target: RefTarget) => (target === 'nodes|groups' ? 'nodes or groups' : target);

/** Throws `DeckEditError('missing-reference')` naming every reference that does not resolve. */
export function assertRefsExist(
  doc: DeckDoc,
  refs: readonly Ref[],
  anyIds: () => ReadonlySet<Id>,
): void {
  const issues = refs
    .filter((ref) => !exists(doc, ref, anyIds))
    .map((ref) => ({
      path: ref.path,
      message: `"${ref.id}" does not exist${ref.target === 'any' ? '' : ` (${targetName(ref.target)})`}.`,
    }));
  if (issues.length > 0) throw new DeckEditError('missing-reference', issues);
}
