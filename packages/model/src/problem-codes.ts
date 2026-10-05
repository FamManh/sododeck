/**
 * The problem code catalogue (062, ADR 0039): every code the app reports, with its family,
 * default severity, a short title and a one-sentence fix hint. Public and stable: a released code
 * never changes meaning and is never reused; one that stops being emitted stays here marked
 * `retired`. `docs/file-format/problem-codes.md` is generated from this table by a file snapshot
 * test, and the AI deck skill (027) reads the same document.
 */
import type { IssueCode } from '@sododeck/schema';

import { SEVERITY, type ProblemKind, type Severity } from './problems';

/** Where a construct of another format went (062 FR-013). */
export type FidelityGroup = 'merged' | 'collapsed' | 'left-out' | 'not-supported';

export const FIDELITY_GROUPS: readonly FidelityGroup[] = [
  'merged',
  'collapsed',
  'left-out',
  'not-supported',
];

export const MERMAID_FIDELITY_CODES = [
  'import-mermaid-appearance',
  'import-mermaid-interaction',
  'import-mermaid-extra-diagram',
  'import-mermaid-unsupported',
  'import-mermaid-unreadable',
  'import-mermaid-flattened',
  'import-mermaid-note',
  'import-mermaid-merged-declaration',
] as const;

export const DB_FIDELITY_CODES = [
  'import-db-view',
  'import-db-function',
  'import-db-procedure',
  'import-db-trigger',
  'import-db-grant',
  'import-db-policy',
  'import-db-partition',
  'import-db-sequence',
  'import-db-extension',
  'import-db-schema',
  'import-db-data',
  'import-db-session',
  'import-db-drop-or-rename',
  'import-db-alter',
  'import-db-dangling-fk',
  'import-db-unknown-table',
  'import-db-parse-error',
  'import-db-unknown',
  'import-db-type-converted',
  'import-db-type-kept',
  'import-db-option-dropped',
  'import-db-renamed-duplicate',
  'import-db-name-exists',
  'import-db-enum-name-exists',
  'import-db-schema-dropped',
] as const;

export type FidelityCode =
  (typeof MERMAID_FIDELITY_CODES)[number] | (typeof DB_FIDELITY_CODES)[number];

export const FIDELITY_CODES: readonly FidelityCode[] = [
  ...MERMAID_FIDELITY_CODES,
  ...DB_FIDELITY_CODES,
];

/**
 * Authoring checks of the AI deck skill's `lint` (027 research R5): taste and modelling advice for
 * AI-written decks. The app never reports them; they live here so their codes never clash with
 * the app's.
 */
export const AUTHORING_CODES = [
  'id-style',
  'positions-mixed',
  'orphan-card',
  'duplicate-title',
  'label-too-long',
  'level-over-budget',
  'connector-without-source',
] as const;

export type AuthoringCode = (typeof AUTHORING_CODES)[number];

/** Every code in the catalogue. */
export type Code =
  | IssueCode
  | 'invalid-json'
  | 'unsupported-version'
  | 'picture-damaged'
  | 'crop-trimmed'
  | ProblemKind
  | 'orphan'
  | FidelityCode
  | AuthoringCode;

export type CodeFamily = 'file' | 'format-rule' | 'load' | 'deck' | 'import' | 'authoring';

export interface CatalogueEntry {
  family: CodeFamily;
  /** `error` refuses a file, `warning` opens with a notice, `info` never notifies. */
  severity: Severity | 'info';
  title: string;
  /** Default fix hint: one sentence a person or an AI can act on. */
  fix: string;
  /** Import codes only: the fidelity group the construct falls in. */
  group?: FidelityGroup;
  /** Never emitted again; the code is never reused. */
  retired?: true;
}

const file = (title: string, fix: string): CatalogueEntry => ({
  family: 'file',
  severity: 'error',
  title,
  fix,
});
const rule = (title: string, fix: string): CatalogueEntry => ({
  family: 'format-rule',
  severity: 'error',
  title,
  fix,
});
const deck = (kind: ProblemKind, title: string, fix: string): CatalogueEntry => ({
  family: 'deck',
  severity: SEVERITY[kind],
  title,
  fix,
});
const imported = (group: FidelityGroup, title: string, fix: string): CatalogueEntry => ({
  family: 'import',
  severity: 'info',
  title,
  fix,
  group,
});

const authoring = (title: string, fix: string): CatalogueEntry => ({
  family: 'authoring',
  severity: 'warning',
  title,
  fix,
});
const NOTHING_TO_FIX = (what: string) => `Nothing to fix: ${what}.`;

export const CATALOGUE: Readonly<Record<Code, CatalogueEntry>> = {
  // File: the file cannot be read as a v1 deck.
  'invalid-json': file(
    'Not JSON',
    'Fix the JSON syntax at the given line and column (often a missing comma, quote or bracket).',
  ),
  'unsupported-version': file(
    'Newer file format',
    'Open it in a newer Sododeck, or write it for format version 1.',
  ),
  'schema-required': file('Missing key', 'Add the missing key with a value of the expected type.'),
  'schema-type': file('Wrong type', 'Change the value to the expected type.'),
  'schema-enum': file('Value not allowed', 'Use one of the allowed values.'),
  'schema-pattern': file('Wrong format', 'Change the value so it has the expected format.'),
  'schema-range': file('Out of range', 'Change the value so it fits the allowed range or length.'),
  'schema-unknown-field': file(
    'Unknown key',
    'Remove the key; the file format has no such key here.',
  ),
  'schema-union': file('No allowed shape', 'Use one of the allowed shapes for the value.'),
  'schema-unique': file('Repeated list entry', 'Remove the repeated entry from the list.'),
  'schema-invalid': file('Invalid value', 'Fix the value so it matches the file format.'),

  // Format rules: checks the JSON Schema cannot express (S1–S15, I1–I6).
  'rule-row-cells': rule(
    'Rule row cell count',
    'Give every row one "when" cell per input column and one "then" cell per output column.',
  ),
  'sticky-placement': rule(
    'Sticky without a place',
    'Give the sticky an "anchor" (an object id), a "position", or both.',
  ),
  'map-key-id': rule('Key is not an id', 'Rename the key to 1–64 letters, digits, -, _, . or :.'),
  'group-frame-pair': rule(
    'Half a group frame',
    'Give the group both "position" and "size", or remove both.',
  ),
  'view-frame-group': rule(
    'Frame for a missing group',
    'Use the id of a group in this file as the key, or remove the entry.',
  ),
  'style-empty': rule('Empty style', 'Give the style a "fill", a "stroke", or both, or remove it.'),
  'edge-style-empty': rule(
    'Empty connector style',
    'Add a key to the connector style, or remove "style".',
  ),
  'tag-color-key': rule(
    'Tag colour key',
    'Use one non-empty key per tag; keys that differ only in case or spacing are the same tag.',
  ),
  'route-anchor-side': rule(
    'Anchor without a side',
    'Add the matching "fromSide" or "toSide", or remove "fromAt" or "toAt".',
  ),
  'route-offset-and-waypoints': rule(
    'Offset and bends together',
    'Keep either "offset" or "waypoints" in the route, not both.',
  ),
  'route-waypoint': rule(
    'Invalid bend',
    'Give each bend exactly one of "x" or "dx" and one of "y" or "dy", and remove an empty "waypoints" list.',
  ),
  'field-definition': rule(
    'Invalid field definition',
    'Keep field and option ids unique, keep the kinds of tech, host and owner, and use "unit" only on number fields, "options" only on select and status fields and icons only on status options.',
  ),
  'card-value-key': rule(
    'Invalid card value key',
    'Use a field id as the key, and store tech, host and owner in their own keys, not in "values".',
  ),
  'column-default': rule(
    'Two column defaults',
    'Keep either "default" or "defaultExpr" on the column, not both.',
  ),
  'step-touch-repeat': rule(
    'Repeated step touch',
    'Keep one touch per table and column in the step.',
  ),
  'image-asset-missing': rule(
    'Image without its picture',
    'Add the picture to "assets", or point "asset" to a picture that is there.',
  ),
  'asset-id': rule(
    'Picture key is not a picture id',
    "Use the picture's SHA-256 as the key: 64 lowercase hex characters.",
  ),
  'asset-data': rule(
    'Picture data and size differ',
    'Make "bytes" the decoded length of "data", and pad the base64 to a multiple of 4.',
  ),
  'image-group-missing': rule(
    'Image in a missing group',
    'Point "group" to a group in this file, or remove it.',
  ),
  'image-id-clash': rule(
    'Image id already used',
    'Give the image an id that no card, group or sticky uses.',
  ),
  'image-too-small': rule('Image too small', 'Make the image at least 32 × 32.'),

  // Load: identity checks on a structurally valid file.
  'duplicate-id': {
    family: 'load',
    severity: 'error',
    title: 'Duplicate id',
    fix: 'Give one of these objects a new, unique id and update references to it.',
  },
  'ambiguous-end': {
    family: 'load',
    severity: 'error',
    title: 'Ambiguous connector end',
    fix: 'Give the node, group or sticky its own id and update the connectors that name it.',
  },
  'picture-damaged': {
    family: 'load',
    severity: 'warning',
    title: 'Damaged picture',
    fix: 'Export the picture again, or put the base64 of the original file in "data" with its SHA-256 as the key.',
  },
  'crop-trimmed': {
    family: 'load',
    severity: 'warning',
    title: 'Image crop past the picture',
    fix: 'Keep "x" + "width" and "y" + "height" of the crop at most 1; the deck shows it cut back to the picture edge.',
  },

  // Deck: the problems list of an open deck (ADR 0013). Codes are the kinds.
  'duplicate-connection': deck(
    'duplicate-connection',
    'Duplicate connection',
    'Delete the extra connectors so each pair is joined once, or give them different labels.',
  ),
  'step-without-connection': deck(
    'step-without-connection',
    'Step without connection',
    'Point the step\'s "edge" to an existing connector id, or remove the step.',
  ),
  'broken-chain': deck(
    'broken-chain',
    'Broken flow',
    'Pick connectors so each step starts where the previous step ended, or reorder the steps.',
  ),
  'incomplete-flow': deck(
    'incomplete-flow',
    'Incomplete flow',
    'Add steps to the flow, and give every branch a label, a condition and existing steps.',
  ),
  'overlapping-conditions': deck(
    'overlapping-conditions',
    'Overlapping conditions',
    'Give each branch of the flow a different condition.',
  ),
  'missing-rule': deck(
    'missing-rule',
    'Missing rule',
    'Point the reference to an existing key of "rules", or remove it.',
  ),
  'rule-without-catch-all': deck(
    'rule-without-catch-all',
    'Rule without catch-all',
    'Add a last row whose "when" cells are all empty or "any", so every input matches a row.',
  ),
  'invalid-rule-cells': deck(
    'invalid-rule-cells',
    'Invalid rule cells',
    'Write each cell as a value, a list ("a, b"), a comparison with a number (">= 3") or "any".',
  ),
  'broken-reference': deck(
    'broken-reference',
    'Broken reference',
    'Point the reference to an existing id, or remove it.',
  ),
  'card-size-out-of-range': deck(
    'card-size-out-of-range',
    'Card size out of range',
    'Set "size" between 120 × 44 and 800 × 600 (shapes may be smaller), or remove it.',
  ),
  'unknown-card-type': deck(
    'unknown-card-type',
    'Unknown card type',
    'Use a card type this version knows, such as "service" or "database".',
  ),
  'unknown-pack': deck(
    'unknown-pack',
    'Unknown pack',
    'Remove the id from "packs", or use a built-in pack: architecture, process, logistics, data, database, shapes.',
  ),
  'field-value-dangling': deck(
    'field-value-dangling',
    'Value without a field',
    'Remove the value from "values", or add the field (and option) it points to in "fields".',
  ),
  'db-dangling-reference': deck(
    'db-dangling-reference',
    'Missing column',
    'Point the reference to an existing column or enum id, or remove it.',
  ),
  'db-composite-mismatch': deck(
    'db-composite-mismatch',
    "Key columns don't match",
    'Give "fromColumns" and "toColumns" the same number of columns.',
  ),
  'db-no-primary-key': deck(
    'db-no-primary-key',
    'No primary key',
    'Mark one or more columns of the table as the primary key ("pk": true).',
  ),
  'db-duplicate-table': deck(
    'db-duplicate-table',
    'Duplicate table',
    'Rename one of the tables so each table name is unique in its schema.',
  ),
  'db-duplicate-column': deck(
    'db-duplicate-column',
    'Duplicate column',
    'Rename one of the columns so each column name is unique in its table.',
  ),
  'db-duplicate-index': deck(
    'db-duplicate-index',
    'Duplicate index',
    'Rename one of the indexes so each index name is unique.',
  ),
  'db-duplicate-enum': deck(
    'db-duplicate-enum',
    'Duplicate enum',
    'Rename one of the enums so each enum name is unique in its schema.',
  ),
  'db-empty-column': deck('db-empty-column', 'Column without a name', 'Give the column a name.'),
  'db-type-mismatch': deck(
    'db-type-mismatch',
    'Type mismatch',
    'Give the referencing columns the same type as the columns they reference.',
  ),
  'db-null-default': deck(
    'db-null-default',
    'Null default on a not-null column',
    'Remove the null default, or allow null in the column.',
  ),
  'db-fk-not-key': deck(
    'db-fk-not-key',
    'Reference to a non-key column',
    'Point the relationship at the primary key or a unique column of the referenced table.',
  ),
  'db-many-to-many': deck(
    'db-many-to-many',
    'Many-to-many',
    'Add a junction table with a foreign key to each side.',
  ),
  'db-empty-enum': deck(
    'db-empty-enum',
    'Enum without values',
    'Add at least one value to the enum.',
  ),
  'db-default-type': deck(
    'db-default-type',
    'Default does not fit the type',
    'Change the default so it fits the column type.',
  ),
  'db-required-loop': deck(
    'db-required-loop',
    'Required references form a loop',
    'Make one foreign key in the loop optional so rows can be inserted.',
  ),
  'db-duplicate-relationship': deck(
    'db-duplicate-relationship',
    'Duplicate relationship',
    'Delete the extra relationship.',
  ),
  'db-unknown-type': deck(
    'db-unknown-type',
    'Type not in the list',
    "Use a type from the dialect's list, or keep it if your database defines it.",
  ),
  orphan: {
    family: 'deck',
    severity: 'warning',
    title: 'Component without connections',
    fix: 'Nothing to fix: no longer reported.',
    retired: true,
  },

  // Import: constructs of another format that did not come across one-to-one (info).
  'import-mermaid-appearance': imported(
    'left-out',
    'Styling',
    NOTHING_TO_FIX('style the cards in Sododeck after the import'),
  ),
  'import-mermaid-interaction': imported(
    'left-out',
    'Clicks and links',
    NOTHING_TO_FIX('add links to the cards in Sododeck after the import'),
  ),
  'import-mermaid-extra-diagram': imported(
    'left-out',
    'Second diagram',
    'Import each diagram on its own.',
  ),
  'import-mermaid-unsupported': imported(
    'not-supported',
    'Syntax not supported',
    'Rewrite the line with the supported flowchart or sequence syntax.',
  ),
  'import-mermaid-unreadable': imported(
    'not-supported',
    'Line not readable',
    'Check the syntax on this line.',
  ),
  'import-mermaid-flattened': imported(
    'collapsed',
    'Block flattened',
    NOTHING_TO_FIX('the block is kept in reading order'),
  ),
  'import-mermaid-note': imported(
    'collapsed',
    'Import note',
    NOTHING_TO_FIX('this says how the input was read'),
  ),
  'import-mermaid-merged-declaration': imported(
    'merged',
    'Declared more than once',
    'Declare each node or group once, or give the second one its own id.',
  ),
  'import-db-view': imported('left-out', 'View', NOTHING_TO_FIX('views are not modelled')),
  'import-db-function': imported(
    'left-out',
    'Function',
    NOTHING_TO_FIX('functions are not modelled'),
  ),
  'import-db-procedure': imported(
    'left-out',
    'Procedure',
    NOTHING_TO_FIX('procedures are not modelled'),
  ),
  'import-db-trigger': imported('left-out', 'Trigger', NOTHING_TO_FIX('triggers are not modelled')),
  'import-db-grant': imported(
    'left-out',
    'Permission or owner',
    NOTHING_TO_FIX('permissions and owners are not modelled'),
  ),
  'import-db-policy': imported('left-out', 'Policy', NOTHING_TO_FIX('policies are not modelled')),
  'import-db-partition': imported(
    'left-out',
    'Partition',
    NOTHING_TO_FIX('partitions are not modelled'),
  ),
  'import-db-sequence': imported(
    'left-out',
    'Sequence',
    NOTHING_TO_FIX('sequences are not modelled'),
  ),
  'import-db-extension': imported(
    'left-out',
    'Extension',
    NOTHING_TO_FIX('extensions are not modelled'),
  ),
  'import-db-schema': imported(
    'collapsed',
    'Schema statement',
    NOTHING_TO_FIX('the schema name is kept on each of its tables'),
  ),
  'import-db-data': imported('left-out', 'Data rows', NOTHING_TO_FIX('data rows are not imported')),
  'import-db-session': imported(
    'left-out',
    'Session setting',
    NOTHING_TO_FIX('session settings do not change the schema'),
  ),
  'import-db-drop-or-rename': imported(
    'left-out',
    'Drop or rename',
    'Write the schema as it should end up, without DROP or RENAME statements.',
  ),
  'import-db-alter': imported(
    'left-out',
    'Other ALTER change',
    'Write the change into the CREATE TABLE statement.',
  ),
  'import-db-dangling-fk': imported(
    'left-out',
    'Reference to a missing table',
    'Include the referenced table in the import.',
  ),
  'import-db-unknown-table': imported(
    'left-out',
    'Change to a missing table',
    "Include the table's CREATE TABLE statement in the import.",
  ),
  'import-db-parse-error': imported(
    'not-supported',
    'Statement not readable',
    'Check the syntax of this statement.',
  ),
  'import-db-unknown': imported(
    'not-supported',
    'Statement not recognised',
    'Remove the statement, or write the schema as CREATE TABLE, CREATE TYPE and CREATE INDEX statements.',
  ),
  'import-db-type-converted': imported(
    'collapsed',
    'Type converted',
    NOTHING_TO_FIX("the type was mapped to the deck's dialect"),
  ),
  'import-db-type-kept': imported(
    'collapsed',
    'Type kept as written',
    NOTHING_TO_FIX('the type is kept as written'),
  ),
  'import-db-option-dropped': imported(
    'left-out',
    'Option dropped',
    NOTHING_TO_FIX('set the option in Sododeck if you need it'),
  ),
  'import-db-renamed-duplicate': imported(
    'merged',
    'Renamed duplicate',
    'Give each table, column or index a unique name in the input.',
  ),
  'import-db-name-exists': imported(
    'merged',
    'Name already in the deck',
    'Rename the table in the input, or import into a new deck.',
  ),
  'import-db-enum-name-exists': imported(
    'merged',
    'Enum name already in the deck',
    'Rename the enum in the input, or import into a new deck.',
  ),
  'import-db-schema-dropped': imported(
    'left-out',
    'Schema dropped',
    NOTHING_TO_FIX("the deck's dialect has no schemas"),
  ),
  // Authoring checks: the AI deck skill's lint only (027).
  'id-style': authoring(
    'Id is not a short slug',
    'Use a short lower-case slug (at most 32 characters) chosen once; never rebuild it from the title.',
  ),
  'positions-mixed': authoring(
    'Some cards placed, some not',
    'Give every card a position or none; without positions the app lays the deck out on import.',
  ),
  'orphan-card': authoring(
    'Card without connections',
    'Connect the card, put it in a group, or delete it if it does not earn its place.',
  ),
  'duplicate-title': authoring(
    'Same title twice',
    'Give each card in the same group and level its own title.',
  ),
  'label-too-long': authoring(
    'Label over budget',
    'Shorten the label; put details in the note or in fields.',
  ),
  'level-over-budget': authoring(
    'Too many cards on one level',
    'Split the level: move related cards under a parent card one level down, or merge minor ones.',
  ),
  'connector-without-source': authoring(
    'No source link',
    'Add a link to the file and lines the connector or card was built from, or remove it.',
  ),
};

/** Whether `code` is in the catalogue (retired codes included). */
export function isCode(code: string): code is Code {
  return Object.hasOwn(CATALOGUE, code);
}

/** The catalogue entry of `code`. */
export function catalogueEntry(code: Code): CatalogueEntry {
  return CATALOGUE[code];
}

const FAMILIES: readonly { family: CodeFamily; heading: string; intro: string }[] = [
  {
    family: 'file',
    heading: 'File',
    intro:
      'The file cannot be read as a format v1 deck. Schema violations use one generic code per violation type; `path` names the exact value. The file is refused.',
  },
  {
    family: 'format-rule',
    heading: 'Format rules',
    intro: 'Rules of the format that the JSON Schema cannot express. The file is refused.',
  },
  {
    family: 'load',
    heading: 'Load checks',
    intro:
      'Identity checks on a structurally valid file (refused), and damaged pictures (the deck opens with the picture shown as missing).',
  },
  {
    family: 'deck',
    heading: 'Deck problems',
    intro:
      'The problems list of an open deck. The deck opens; error and warning problems are counted in the notice after an import.',
  },
  {
    family: 'import',
    heading: 'Import from other formats',
    intro:
      'What a Mermaid, SQL or DBML import could not bring across one-to-one, by group: merged, collapsed, left out, not supported. Never an error.',
  },
  {
    family: 'authoring',
    heading: 'Authoring checks (AI deck skill)',
    intro:
      "Reported only by the AI deck skill's `lint`, never by the app: advice for decks written by an AI agent. Always warnings.",
  },
];

const cell = (text: string) => text.replaceAll('|', '\\|');

/** The catalogue as Markdown, one table per family (062 R7). Deterministic. */
export function renderCatalogueMarkdown(): string {
  const lines = [
    '# Problem codes',
    '',
    '<!-- Generated from packages/model/src/problem-codes.ts by its test. Do not edit; run',
    '     `pnpm --filter @sododeck/model test -u` after changing the catalogue. -->',
    '',
    'Every problem Sododeck reports when it reads a `.sododeck` file, lists for an open deck, or',
    'meets while importing another format has a stable code. A released code never changes',
    'meaning and is never reused; codes that are no longer reported stay listed as retired.',
    'The copied report shape is in `specs/062-fixable-import-errors/contracts/problem-report.md`.',
    '',
    'Severity: `error` refuses a file (or marks a deck problem as an error), `warning` opens with a',
    'notice, `info` never notifies.',
  ];
  const codes = Object.keys(CATALOGUE) as Code[];
  for (const { family, heading, intro } of FAMILIES) {
    lines.push('', `## ${heading}`, '', intro, '');
    const withGroup = family === 'import';
    lines.push(
      withGroup ? '| Code | Group | Title | Fix |' : '| Code | Severity | Title | Fix |',
      '| --- | --- | --- | --- |',
    );
    for (const code of codes) {
      const entry = CATALOGUE[code];
      if (entry.family !== family) continue;
      const name = entry.retired === true ? `\`${code}\` (retired)` : `\`${code}\``;
      const second = withGroup ? (entry.group ?? '') : entry.severity;
      lines.push(`| ${name} | ${second} | ${cell(entry.title)} | ${cell(entry.fix)} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}
