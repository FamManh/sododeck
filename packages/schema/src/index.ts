import jsonSchemaV1 from '../schema/v1.json' with { type: 'json' };
import type { SododeckFile } from './generated/types';
import { sododeckFileSchema } from './generated/zod';

export type * from './generated/types';
export { sododeckFileSchema };

/** The v1 JSON Schema document (for Monaco, Ajv, publishing). */
export const jsonSchema = jsonSchemaV1;

export const SCHEMA_URL = 'https://sododeck.com/schema/v1.json';
export const FORMAT_VERSION = 1;

export type ParseResult =
  | { success: true; data: SododeckFile }
  | { success: false; issues: { path: string; message: string }[] };

/** Validates unknown input (e.g. parsed JSON from an imported file) against the v1 schema. */
export function parseSododeckFile(input: unknown): ParseResult {
  const result = sododeckFileSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
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
