# Contract: package APIs (062)

## `@sododeck/schema`

```ts
export type IssueCode = SchemaIssueCode | FormatRuleCode; // issue-codes.ts
export interface Issue {
  code: IssueCode | LoadIssueCode; // LoadIssueCode widens via model; schema emits its own
  path: string; // JSON Pointer
  message: string;
  subject?: string;
  evidence?: string;
  fix?: string;
}
export function toPointer(segments: readonly (string | number)[]): string;
export function parseSododeckFile(input: unknown): ParseResult; // issues carry code + pointer
export function checkSemanticRules(file: SododeckFile): Issue[]; // each push carries its code
```

`Issue.code` is typed as a string-literal union. The schema package defines `SchemaIssueCode`
and `FormatRuleCode`; the model's load-check codes (`duplicate-id`, `ambiguous-end`) are added
to the union in schema too (as plain literals) so `Issue` stays one type without a reverse
dependency.

## `@sododeck/model`

```ts
// problem-codes.ts
export const CATALOGUE: Readonly<Record<Code, CatalogueEntry>>;
export type Code =
  | IssueCode
  | 'invalid-json'
  | 'unsupported-version'
  | 'picture-damaged'
  | ProblemKind
  | 'orphan'
  | FidelityCode;
export function renderCatalogueMarkdown(): string;

// problem-entry.ts
export function issueEntry(issue: Issue, input?: unknown): ProblemEntry; // evidence from input
export function problemEntry(problem: Problem): ProblemEntry;
export function pictureEntry(problem: AssetProblem, index: number): ProblemEntry;
export function sortEntries(entries: readonly ProblemEntry[]): ProblemEntry[];
export function problemReport(args: {
  source: { kind: 'file' | 'deck'; name: string };
  status: 'refused' | 'opened';
  app: string;
  entries: readonly ProblemEntry[];
}): ProblemReport; // applies the 5,000 cap and `omitted`
export function stringifyReport(report: ProblemReport | FidelityReport): string; // 2-space JSON

// import-check.ts
export type DeckTextResult =
  | { ok: false; entries: ProblemEntry[] } // refused, sorted
  | { ok: true; loaded: LoadedDeck; entries: ProblemEntry[] }; // opened; entries = pictures
// + checkDeck error/warning
export function inspectDeckText(text: string): DeckTextResult;

// problems.ts
export interface Problem {
  /* existing */ path: string;
  subject?: Id;
}
```

- `loadDeck` / `fromJSON` keep throwing `DeckValidationError(issues)` (issues now coded); used by
  callers that do not need entries (tests, paste, apply-import).
- `inspectDeckText` never throws for user input; programming errors still throw.

## App (`apps/app`)

```ts
// storage/library-ops.ts
class LibraryOpError {
  code;
  message;
  problems?: ProblemEntry[];
} // carried to LibraryClientError
interface ImportedDeck {
  /* existing */ openProblems: ProblemEntry[];
} // replaces `problems`

// import-mermaid/fidelity.ts, db/import/fidelity.ts
export function toFidelityReport(report: ImportReport, name?: string): FidelityReport;
```
