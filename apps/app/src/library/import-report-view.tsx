import { useId } from 'react';

import { describeReason, summaryText, type ImportReport } from '../import-mermaid/import-report';

/**
 * What a Mermaid import did (056 US4): the counts as text, any notes, and every skipped line with
 * its number and reason. Meaning is in words, never in colour alone (constitution VII); text is
 * rendered by React as text, so nothing from the diagram is ever interpreted as markup.
 */
export function ImportReportView({ report }: { report: ImportReport }) {
  const headingId = useId();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-md font-medium text-ink">{summaryText(report)}</p>
      {report.notes.length > 0 && (
        <ul className="list-disc pl-5 text-body-sm text-ink-secondary">
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {report.skipped.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">Nothing was skipped.</p>
      ) : (
        <section className="flex flex-col gap-1.5">
          <h3 id={headingId} className="text-body-sm font-medium text-ink-secondary">
            {report.skipped.length === 1
              ? '1 line skipped'
              : `${report.skipped.length} lines skipped`}
          </h3>
          <ul
            aria-labelledby={headingId}
            className="max-h-56 overflow-y-auto rounded-input border border-border bg-surface"
          >
            {report.skipped.map((entry, index) => (
              <li
                key={`${entry.line}-${index}`}
                className="flex flex-col gap-0.5 border-b border-hairline px-3 py-2 last:border-b-0"
              >
                <span className="text-body-sm text-ink">
                  <span className="font-medium">Line {entry.line}:</span>{' '}
                  <code className="font-mono text-code-md">{entry.text}</code>
                </span>
                <span className="text-body-sm text-ink-secondary">
                  {describeReason(entry.reason)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
