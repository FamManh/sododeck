/**
 * Validation of edits before they are written (research R4). Yjs transactions cannot roll back,
 * so every operation builds its candidate plain object, checks it here, and only then writes.
 * Validity comes from the generated Zod in @sododeck/schema; nothing is redefined here.
 */
import {
  checkSemanticRules,
  emptySododeckFile,
  sododeckFileSchema,
  toIssues,
  type Id,
  type Issue,
  type SododeckFile,
} from '@sododeck/schema';
import { isRecord } from './convert';
import { collectionMap, rulesMap, type Collection, type DeckDoc } from './layout';
import { DeckEditError, type EditIssue } from './errors';

/** The part of a Zod schema used here, so this package needs no direct zod dependency. */
interface Schema {
  safeParse(
    value: unknown,
  ): { success: true } | { success: false; error: Parameters<typeof toIssues>[0] };
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
  images: shape.images.unwrap().element,
  asset: shape.assets.unwrap().valueType,
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
      groupingMode: true,
      blockSqlExport: true,
      tableDisplay: true,
      relationshipDisplay: true,
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
  | 'enumValue'
  | 'asset',
  Schema
>;

export type ValidationKind = keyof typeof ELEMENT_SCHEMAS;

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
    case 'images': {
      // I6 on one image. Its picture and group exist as far as this check goes: whether they do
      // is the model's job (`assertRefsExist`, the integrity report), not a format check.
      const image = isRecord(candidate) ? candidate : {};
      const group = typeof image.group === 'string' ? image.group : undefined;
      const asset = typeof image.asset === 'string' ? image.asset : undefined;
      return {
        ...file,
        groups: group === undefined ? [] : [{ id: group, title: group }],
        images: [candidate],
        assets:
          asset === undefined
            ? {}
            : {
                [asset]: {
                  type: 'image/png',
                  bytes: 1,
                  width: 1,
                  height: 1,
                  name: '',
                  data: 'AA==',
                },
              },
      } as SododeckFile;
    }
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
  if (!result.success) return toIssues(result.error, candidate);
  if (kind === 'dbColumn') {
    // S14 (040) on one column, inside a one-table file; paths name the column's own keys.
    const file = {
      ...emptySododeckFile(),
      nodes: [{ id: 't', type: 'db-table', title: 't', columns: [candidate] }],
    } as SododeckFile;
    const prefix = '/nodes/0/columns/0';
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
export function assertValid(issues: EditIssue[]): void {
  if (issues.length > 0) throw new DeckEditError('invalid', issues);
}

/** `'nodes|groups|stickies|images'`: a connector end (050, 053, 055). */
export type RefTarget = Collection | 'nodes|groups|stickies|images' | 'rule';

export interface Ref {
  /** Field holding the reference, e.g. `from` or `includes.2`. */
  path: string;
  id: Id;
  target: RefTarget;
}

function exists(doc: DeckDoc, ref: Ref): boolean {
  switch (ref.target) {
    case 'rule':
      return rulesMap(doc).has(ref.id);
    case 'nodes|groups|stickies|images':
      return (
        collectionMap(doc, 'nodes').has(ref.id) ||
        collectionMap(doc, 'groups').has(ref.id) ||
        collectionMap(doc, 'stickies').has(ref.id) ||
        collectionMap(doc, 'images').has(ref.id)
      );
    default:
      return collectionMap(doc, ref.target).has(ref.id);
  }
}

const targetName = (target: RefTarget) =>
  target === 'nodes|groups|stickies|images' ? 'nodes, groups, stickies or images' : target;

/** Throws `DeckEditError('missing-reference')` naming every reference that does not resolve. */
export function assertRefsExist(doc: DeckDoc, refs: readonly Ref[]): void {
  const issues = refs
    .filter((ref) => !exists(doc, ref))
    .map((ref) => ({
      path: ref.path,
      message: `"${ref.id}" does not exist (${targetName(ref.target)}).`,
    }));
  if (issues.length > 0) throw new DeckEditError('missing-reference', issues);
}
