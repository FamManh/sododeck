/**
 * Codes of the issues that refuse a file (062, ADR 0039). Public and stable: a released code
 * never changes meaning. The catalogue with titles and fix hints is `@sododeck/model`'s
 * `problem-codes.ts`; this package only names the codes it (and the model's load checks) emit.
 */

/** Generic schema violations, one per violation type (062 R3, clarification Q3). */
export const SCHEMA_ISSUE_CODES = [
  'schema-required',
  'schema-type',
  'schema-enum',
  'schema-pattern',
  'schema-range',
  'schema-unknown-field',
  'schema-union',
  'schema-unique',
  'schema-invalid',
] as const;
export type SchemaIssueCode = (typeof SCHEMA_ISSUE_CODES)[number];

/** Format rules S1–S15 and I1, I3–I6 of `semantic-rules.ts` (062 R4; I2 is a permission). */
export const FORMAT_RULE_CODES = [
  'rule-row-cells', // S1
  'sticky-placement', // S2
  'map-key-id', // S3
  'group-frame-pair', // S4
  'view-frame-group', // S5
  'style-empty', // S6
  'edge-style-empty', // S7
  'tag-color-key', // S8
  'route-anchor-side', // S9
  'route-offset-and-waypoints', // S10
  'route-waypoint', // S11
  'field-definition', // S12
  'card-value-key', // S13
  'column-default', // S14
  'step-touch-repeat', // S15
  'image-asset-missing', // I1
  'asset-id', // I4 (the key is a picture id)
  'asset-data', // I4 (data decodes to `bytes`)
  'image-group-missing', // I3
  'image-id-clash', // I5
  'image-too-small', // I6
  'image-asset-source', // I8
  'image-asset-path', // I9
] as const;
export type FormatRuleCode = (typeof FORMAT_RULE_CODES)[number];

/**
 * Identity checks `@sododeck/model` runs on load. Listed here so `Issue` stays one type without
 * the schema package depending on the model.
 */
export const LOAD_ISSUE_CODES = ['duplicate-id', 'ambiguous-end'] as const;
export type LoadIssueCode = (typeof LOAD_ISSUE_CODES)[number];

export type IssueCode = SchemaIssueCode | FormatRuleCode | LoadIssueCode;
