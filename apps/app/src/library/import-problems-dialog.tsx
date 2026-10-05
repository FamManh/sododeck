import {
  stringifyReport,
  type ProblemEntry,
  type ProblemReport,
} from '@sododeck/model/report-json';
import { Button } from '@sododeck/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { useCallback, useId, useRef, type RefObject } from 'react';

import { CopyFallback } from '../lib/copy-fallback';
import { useCopyReport } from '../lib/copy-report';
import { ProblemSeverityIcon } from './problem-severity-icon';

/** What the import problems dialog shows (062 contracts/ui.md). */
export type ImportProblemsRequest =
  /** A deck file that was refused: nothing was added. `name` is the file name. */
  | { mode: 'refused'; name: string; report: ProblemReport }
  /** A deck that opened with problems. `name` is the deck name. */
  | { mode: 'opened'; name: string; deckId: string; report: ProblemReport };

/** Rows rendered at most; the rest are counted (062 SC-004: 10,000 problems open in < 1 s). */
const DIALOG_ROWS = 500;

const number = (n: number) => n.toLocaleString('en-US');

function locationOf(entry: ProblemEntry): string {
  if (entry.path !== undefined) return entry.path === '' ? 'whole file' : entry.path;
  if (entry.line !== undefined) {
    return entry.column === undefined
      ? `line ${String(entry.line)}`
      : `line ${String(entry.line)}, column ${String(entry.column)}`;
  }
  return 'whole file';
}

function ProblemRow({ entry }: { entry: ProblemEntry }) {
  return (
    <li className="flex gap-2 border-b border-hairline px-3 py-2 last:border-b-0">
      <ProblemSeverityIcon severity={entry.severity} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-sm text-ink">{entry.message}</span>
        <code className="font-mono text-code-md break-all text-ink-secondary">
          {locationOf(entry)}
        </code>
        <span className="text-body-sm text-ink-muted">{entry.fix}</span>
      </div>
    </li>
  );
}

function ProblemsBody({
  request,
  onOpenDeck,
  primary,
}: {
  request: ImportProblemsRequest;
  onOpenDeck: (deckId: string) => void;
  /** The primary button, focused when the dialog opens. */
  primary: RefObject<HTMLButtonElement | null>;
}) {
  const { report } = request;
  const listId = useId();
  const build = useCallback(() => stringifyReport(report), [report]);
  const { copy, text } = useCopyReport(build, 'Copied problems');
  const total = report.counts.error + report.counts.warning + report.counts.info;
  const shown = report.problems.slice(0, DIALOG_ROWS);
  const more = total - shown.length;
  const refused = request.mode === 'refused';
  const summary = `${total === 1 ? '1 problem' : `${number(total)} problems`}. ${
    refused ? 'Nothing was added.' : 'The deck opened unchanged.'
  }`;

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>
          {refused ? `Couldn't open "${request.name}"` : `"${request.name}" opened with problems`}
        </DialogTitle>
        <DialogDescription>{summary}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <h3 id={listId} className="sr-only">
          Problems
        </h3>
        <ul
          aria-labelledby={listId}
          className="max-h-80 overflow-y-auto rounded-input border border-border bg-surface"
        >
          {shown.map((entry, index) => (
            <ProblemRow key={`${entry.code}:${entry.path ?? ''}:${String(index)}`} entry={entry} />
          ))}
        </ul>
        {more > 0 && <p className="text-body-sm text-ink-secondary">and {number(more)} more</p>}
      </div>
      {text !== null && <CopyFallback text={text} label="Problems as JSON" />}
      <DialogFooter>
        <Button
          ref={refused ? primary : undefined}
          type="button"
          variant={refused ? 'primary' : 'secondary'}
          onClick={() => {
            void copy();
          }}
        >
          Copy problems
        </Button>
        {request.mode === 'opened' && (
          <Button
            ref={primary}
            type="button"
            variant="primary"
            onClick={() => {
              onOpenDeck(request.deckId);
            }}
          >
            Open deck
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

/**
 * Why a deck file was refused, or what an imported deck opened with (062 US1, US2): every problem
 * with its location and fix hint, and Copy problems for the user's AI. Library-safe: the report
 * comes ready from the library worker, and copying needs only `@sododeck/model/report-json`.
 */
export function ImportProblemsDialog({
  request,
  onClose,
  onOpenDeck,
}: {
  request: ImportProblemsRequest | null;
  onClose: () => void;
  onOpenDeck: (deckId: string) => void;
}) {
  const primary = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-[640px]"
        onOpenAutoFocus={(event) => {
          // Focus starts on the primary action, not the close button (contracts/ui.md).
          event.preventDefault();
          primary.current?.focus();
        }}
      >
        {request !== null && (
          <ProblemsBody request={request} onOpenDeck={onOpenDeck} primary={primary} />
        )}
      </DialogContent>
    </Dialog>
  );
}
