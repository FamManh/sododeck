import jsonSchemaV1 from '../schema/v1.json' with { type: 'json' };
import type { SododeckFile } from './generated/types';
import { sododeckFileSchema } from './generated/zod';
import { checkSemanticRules, type Issue } from './semantic-rules';

export type * from './generated/types';
export { checkSemanticRules, sododeckFileSchema };
export type { Issue };

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
  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  };
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
