/**
 * Zod issues → coded, pointer-addressed `Issue`s (062 R3). Schema violations use a small set of
 * generic codes, one per violation type; `path` carries the precision and the fix hint is
 * composed from the violation itself (expected type, allowed values, bounds, key names), so it
 * never drifts from the schema.
 */
import type { $ZodIssue } from 'zod/v4/core';

import { toPointer } from './pointer';
import type { Issue } from './semantic-rules';

type Segment = PropertyKey;

/** Longest evidence kept, in characters, `…` included (062 FR edge case "long evidence"). */
export const EVIDENCE_MAX = 200;

/** A JSON value as short text for `evidence`, trimmed to {@link EVIDENCE_MAX} characters. */
export function evidenceOf(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  // Inputs are parsed JSON: no cycles, no functions, so this always yields text.
  const text = JSON.stringify(value);
  return text.length > EVIDENCE_MAX ? `${text.slice(0, EVIDENCE_MAX - 1)}…` : text;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The value at `path` in `input`, or `undefined` when the path does not resolve. */
export function valueAt(input: unknown, path: readonly Segment[]): unknown {
  let value = input;
  for (const segment of path) {
    if (Array.isArray(value)) {
      const index = typeof segment === 'number' ? segment : Number(String(segment));
      value = Number.isInteger(index) ? value[index] : undefined;
    } else if (isObject(value) && typeof segment !== 'symbol') {
      const key = String(segment);
      value = Object.hasOwn(value, key) ? value[key] : undefined;
    } else return undefined;
  }
  return value;
}

/** Maps whose keys are object ids: the key is the subject inside them. */
const ID_MAPS = new Set(['rules', 'assets']);

/**
 * Id of the object the value at `path` belongs to: the nearest enclosing object with a string
 * `id`, or the key of a `rules` / `assets` entry. Never a title (constitution III).
 */
export function subjectAt(input: unknown, path: readonly Segment[]): string | undefined {
  let subject: string | undefined;
  let value = input;
  for (let i = 0; i <= path.length; i++) {
    if (isObject(value) && typeof value.id === 'string') subject = value.id;
    const segment = path[i];
    if (segment === undefined) break;
    if (i === 1 && ID_MAPS.has(String(path[0]))) subject = String(segment);
    value = valueAt(value, [segment]);
  }
  return subject;
}

/** Singular names of the lists and maps that hold objects, for "to node "payments"". */
const OWNER: Readonly<Record<string, string>> = {
  nodes: 'node',
  groups: 'group',
  edges: 'connector',
  views: 'view',
  features: 'feature',
  flows: 'flow',
  steps: 'step',
  branches: 'branch',
  rules: 'rule',
  inputs: 'column',
  outputs: 'column',
  rows: 'row',
  stickies: 'sticky',
  images: 'image',
  assets: 'picture',
  fields: 'field',
  options: 'option',
  columns: 'column',
  indexes: 'index',
  checks: 'check',
  enums: 'enum',
  values: 'value',
};

/** "node "payments"" for the object at `path` (the nearest list entry or id-map entry). */
function ownerOf(input: unknown, path: readonly Segment[]): string | undefined {
  for (let i = path.length - 1; i >= 1; i--) {
    const list = String(path[i - 1]);
    const noun = OWNER[list];
    if (i === 1 && ID_MAPS.has(list)) return `${noun ?? 'entry'} "${String(path[1])}"`;
    const entry = valueAt(input, path.slice(0, i + 1));
    if (typeof path[i] !== 'number' || !isObject(entry) || typeof entry.id !== 'string') continue;
    return noun === undefined ? undefined : `${noun} "${entry.id}"`;
  }
  return undefined;
}

/** The key a path ends on, for messages: the last non-index segment. */
function fieldOf(path: readonly Segment[]): string {
  for (let i = path.length - 1; i >= 0; i--) {
    const segment = path[i];
    if (typeof segment === 'string') return segment;
  }
  return 'value';
}

const EXPECTED: Readonly<Record<string, string>> = {
  string: 'a string',
  number: 'a number',
  int: 'a whole number',
  boolean: 'true or false',
  array: 'a list',
  object: 'an object',
  record: 'an object',
  null: 'null',
};

function describeExpected(expected: string): string {
  return EXPECTED[expected] ?? `a ${expected}`;
}

function describeReceived(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'a list';
  switch (typeof value) {
    case 'string':
      return 'a string';
    case 'number':
      return 'a number';
    case 'boolean':
      return String(value);
    default:
      return 'an object';
  }
}

/** At most 12 allowed values, then "…" (062 R3). */
function listValues(values: readonly unknown[]): string {
  const shown = values.slice(0, 12).map((value) => JSON.stringify(value));
  return values.length > 12 ? `${shown.join(', ')}, …` : shown.join(', ');
}

/** Patterns of v1.json in plain words; any other pattern is quoted. */
const PATTERNS: Readonly<Record<string, string>> = {
  '/^[A-Za-z0-9_.:-]{1,64}$/': '1–64 letters, digits, -, _, . or :',
  '/^[a-z][a-z0-9-]{0,47}$/': 'a lowercase letter, then up to 47 lowercase letters, digits or -',
  '/^#[0-9a-f]{6}$/': 'a lowercase 6-digit hex colour such as "#7a3cff"',
  '/^[0-9a-f]{64}$/': '64 lowercase hex characters (the SHA-256 of the picture)',
};

function describePattern(pattern: string | undefined): string {
  if (pattern === undefined) return 'the expected format';
  return PATTERNS[pattern] ?? `text matching ${pattern}`;
}

function describeBound(issue: $ZodIssue & { code: 'too_small' | 'too_big' }): string {
  const small = issue.code === 'too_small';
  const bound = Number(small ? issue.minimum : issue.maximum);
  const inclusive = issue.inclusive !== false;
  switch (issue.origin) {
    case 'string':
      if (small && bound === 1) return 'non-empty';
      return `${small ? 'at least' : 'at most'} ${String(bound)} characters long`;
    case 'array':
    case 'set':
      return `${small ? 'at least' : 'at most'} ${String(bound)} item${bound === 1 ? '' : 's'} long`;
    default:
      if (small) return inclusive ? `at least ${String(bound)}` : `greater than ${String(bound)}`;
      return inclusive ? `at most ${String(bound)}` : `less than ${String(bound)}`;
  }
}

/** One branch's first issue described as a shape, for a union nothing matched. */
function describeBranch(issue: $ZodIssue | undefined): string | undefined {
  if (issue === undefined) return undefined;
  switch (issue.code) {
    case 'invalid_value':
      return listValues(issue.values);
    case 'invalid_type':
      return describeExpected(issue.expected);
    case 'invalid_format':
      return describePattern(issue.pattern);
    default:
      return undefined;
  }
}

/** Whether a branch failed on the value itself, not inside it. */
const failsAtRoot = (branch: readonly $ZodIssue[]) =>
  branch.some((issue) => issue.path.length === 0);

/** Prefer branches that got past the value's own type, then the fewest issues (062 R3). */
function closestBranch(
  errors: readonly (readonly $ZodIssue[])[],
): readonly $ZodIssue[] | undefined {
  let best: readonly $ZodIssue[] | undefined;
  for (const branch of errors) {
    if (failsAtRoot(branch)) continue;
    if (best === undefined || branch.length < best.length) best = branch;
  }
  return best;
}

/** What a missing key should hold, or `undefined` when the issue is not about a missing key. */
function expectedShape(issue: $ZodIssue): string | undefined {
  switch (issue.code) {
    case 'invalid_type':
      return describeExpected(issue.expected);
    case 'invalid_value':
      return issue.values.length === 1
        ? JSON.stringify(issue.values[0])
        : `one of: ${listValues(issue.values)}`;
    case 'invalid_union': {
      const shapes = [...new Set(issue.errors.map((branch) => describeBranch(branch[0])))];
      return shapes.every((shape) => shape !== undefined) ? shapes.join('; or ') : 'a value';
    }
    default:
      return undefined;
  }
}

const ROOT_FIX =
  'Make the file one JSON object with "$schema", "version", "nodes" and the other top-level keys.';

function build(
  input: unknown,
  path: readonly Segment[],
  issue: Omit<Issue, 'path' | 'subject' | 'evidence'>,
  evidence: unknown,
): Issue {
  const subject = subjectAt(input, path);
  const shown = evidenceOf(evidence);
  return {
    code: issue.code,
    path: toPointer(path),
    ...(subject === undefined ? {} : { subject }),
    message: issue.message,
    ...(shown === undefined ? {} : { evidence: shown }),
    ...(issue.fix === undefined ? {} : { fix: issue.fix }),
  };
}

function convert(issue: $ZodIssue, prefix: readonly Segment[], input: unknown): Issue[] {
  const path = [...prefix, ...issue.path];
  const value = valueAt(input, path);
  const field = fieldOf(path);
  const quoted = `"${field}"`;
  if (value === undefined && path.length > 0) {
    const shape = expectedShape(issue);
    if (shape !== undefined) {
      const owner = ownerOf(input, path.slice(0, -1));
      return [
        build(
          input,
          path,
          {
            code: 'schema-required',
            message: `${quoted} is missing.`,
            fix: `Add ${quoted} (${shape})${owner === undefined ? '' : ` to ${owner}`}.`,
          },
          undefined,
        ),
      ];
    }
  }
  switch (issue.code) {
    case 'invalid_type': {
      if (path.length === 0) {
        return [
          build(
            input,
            path,
            { code: 'schema-type', message: 'The file is not a JSON object.', fix: ROOT_FIX },
            value,
          ),
        ];
      }
      const expected = describeExpected(issue.expected);
      return [
        build(
          input,
          path,
          {
            code: 'schema-type',
            message: `${quoted} should be ${expected}, not ${describeReceived(value)}.`,
            fix: `Make ${quoted} ${expected}.`,
          },
          value,
        ),
      ];
    }
    case 'invalid_value': {
      const only = issue.values.length === 1;
      return [
        build(
          input,
          path,
          {
            code: 'schema-enum',
            message: only
              ? `${quoted} must be ${JSON.stringify(issue.values[0])}.`
              : `${quoted} has a value that is not allowed.`,
            fix: only
              ? `Set ${quoted} to ${JSON.stringify(issue.values[0])}.`
              : `Use one of: ${listValues(issue.values)}.`,
          },
          value,
        ),
      ];
    }
    case 'invalid_format': {
      const shape = describePattern(issue.pattern);
      return [
        build(
          input,
          path,
          {
            code: 'schema-pattern',
            message: `${quoted} does not have the expected format.`,
            fix: `Make ${quoted} ${shape}.`,
          },
          value,
        ),
      ];
    }
    case 'too_small':
    case 'too_big':
      return [
        build(
          input,
          path,
          {
            code: 'schema-range',
            message: `${quoted} is too ${issue.code === 'too_small' ? 'small' : 'big'}.`,
            fix: `Make ${quoted} ${describeBound(issue)}.`,
          },
          value,
        ),
      ];
    case 'not_multiple_of':
      return [
        build(
          input,
          path,
          {
            code: 'schema-range',
            message: `${quoted} is not a multiple of ${String(issue.divisor)}.`,
            fix: `Make ${quoted} a multiple of ${String(issue.divisor)}.`,
          },
          value,
        ),
      ];
    case 'unrecognized_keys':
      return issue.keys.map((key) =>
        build(
          input,
          [...path, key],
          {
            code: 'schema-unknown-field',
            message: `"${key}" is not a known field here.`,
            fix: `Remove "${key}".`,
          },
          valueAt(value, [key]),
        ),
      );
    case 'invalid_union': {
      const branch = closestBranch(issue.errors);
      if (branch !== undefined) return branch.flatMap((inner) => convert(inner, path, input));
      const shapes = [...new Set(issue.errors.map((b) => describeBranch(b[0])))];
      const known = shapes.filter((shape): shape is string => shape !== undefined);
      return [
        build(
          input,
          path,
          {
            code: 'schema-union',
            message: `${quoted} does not match any allowed shape.`,
            fix:
              known.length === shapes.length && known.length > 0
                ? `Make ${quoted} one of: ${known.join('; or ')}.`
                : `Use one of the allowed shapes for ${quoted}.`,
          },
          value,
        ),
      ];
    }
    case 'custom': {
      // The only refinement json-schema-to-zod emits is `uniqueItems`.
      if (Array.isArray(value)) {
        const repeat = value.findIndex(
          (item, i) =>
            value.findIndex((other) => JSON.stringify(other) === JSON.stringify(item)) !== i,
        );
        const at = repeat === -1 ? path : [...path, repeat];
        return [
          build(
            input,
            at,
            {
              code: 'schema-unique',
              message: `${quoted} lists the same value more than once.`,
              fix: `Remove the repeated entry from ${quoted}.`,
            },
            repeat === -1 ? value : value[repeat],
          ),
        ];
      }
      break;
    }
    default:
      break;
  }
  return [
    build(
      input,
      path,
      {
        code: 'schema-invalid',
        message: `${quoted} does not match the file format.`,
        fix: `Fix ${quoted} so it matches the file format.`,
      },
      value,
    ),
  ];
}

/** Every Zod issue as coded `Issue`s with JSON Pointer paths, read against the original input. */
export function toIssues(error: { issues: readonly $ZodIssue[] }, input: unknown): Issue[] {
  return error.issues.flatMap((issue) => convert(issue, [], input));
}
