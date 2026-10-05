import jsonSchemaV1 from '../schema/v1.json' with { type: 'json' };
import type { SododeckFile } from './generated/types';
import { sododeckFileSchema } from './generated/zod';
import { ASSET_ID_PATTERN, checkSemanticRules, IMAGE_MIN_SIDE, type Issue } from './semantic-rules';
import { toIssues } from './zod-issues';

export type * from './generated/types';
export { ASSET_ID_PATTERN, checkSemanticRules, IMAGE_MIN_SIDE, sododeckFileSchema };
export type { Issue };
export {
  FORMAT_RULE_CODES,
  LOAD_ISSUE_CODES,
  SCHEMA_ISSUE_CODES,
  type FormatRuleCode,
  type IssueCode,
  type LoadIssueCode,
  type SchemaIssueCode,
} from './issue-codes';
export { comparePointers, toPointer } from './pointer';
export { EVIDENCE_MAX, evidenceOf, subjectAt, toIssues, valueAt } from './zod-issues';

/** The v1 JSON Schema document (for Monaco, Ajv, publishing). */
export const jsonSchema = jsonSchemaV1;

export const SCHEMA_URL = 'https://sododeck.com/schema/v1.json';
export const FORMAT_VERSION = 1;

export type ParseResult =
  { success: true; data: SododeckFile } | { success: false; issues: Issue[] };

/**
 * Validates unknown input (e.g. parsed JSON from an imported file) against the v1 format:
 * the generated structural validator, then the semantic rules it cannot express.
 * On success, `data` deep-equals the input. Does not check ids or references (see @sododeck/model).
 */
export function parseSododeckFile(input: unknown): ParseResult {
  const result = sododeckFileSchema.safeParse(input);
  if (result.success) {
    const issues = checkSemanticRules(result.data);
    return issues.length === 0 ? { success: true, data: result.data } : { success: false, issues };
  }
  return { success: false, issues: toIssues(result.error, input) };
}

/** An empty, valid v1 file. */
export function emptySododeckFile(): SododeckFile {
  return {
    $schema: SCHEMA_URL,
    version: FORMAT_VERSION,
    nodes: [],
    groups: [],
    edges: [],
    views: [],
    features: [],
    flows: [],
    rules: {},
    stickies: [],
  };
}
