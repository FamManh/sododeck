import { stringifyReport, type FidelityItem } from '@sododeck/model/report-json';
import { Button } from '@sododeck/ui/components/button';
import { Copy } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { toFidelityReport } from '../import-mermaid/fidelity';
import { summaryText, type ImportReport } from '../import-mermaid/import-report';
import { CopyFallback } from '../lib/copy-fallback';
import { useCopyReport } from '../lib/copy-report';
import { FidelityGroups } from './fidelity-groups';

function where(item: FidelityItem): string | null {
  if (item.lines !== undefined) {
    return `Lines ${item.lines.slice(0, -1).join(', ')} and ${String(item.lines.at(-1))}`;
  }
  return item.line === undefined ? null : `Line ${String(item.line)}`;
}

function ItemRows({ items }: { items: FidelityItem[] }) {
  return (
    <ul className="max-h-56 overflow-y-auto rounded-input border border-border bg-surface">
      {items.map((item, index) => {
        const at = where(item);
        return (
          <li
            key={`${item.code}-${String(item.line ?? item.lines?.[0] ?? 'note')}-${String(index)}`}
            className="flex flex-col gap-0.5 border-b border-hairline px-3 py-2 last:border-b-0"
          >
            {item.excerpt !== undefined && (
              <span className="text-body-sm text-ink">
                {at !== null && <span className="font-medium">{at}:</span>}{' '}
                <code className="font-mono text-code-md">{item.excerpt}</code>
              </span>
            )}
            <span className="text-body-sm text-ink-secondary">{item.message}</span>
            {item.fix !== undefined && (
              <span className="text-body-sm text-ink-muted">{item.fix}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What a Mermaid import did (056 US4, 062 US3): the counts as text, then everything that did not
 * come across one-to-one under Merged, Collapsed, Left out and Not supported, with line numbers,
 * reasons and fix hints, and Copy report. Meaning is in words, never in colour alone
 * (constitution VII); diagram text is rendered by React as text, never as markup.
 */
export function ImportReportView({ report, name }: { report: ImportReport; name?: string }) {
  const fidelity = useMemo(() => toFidelityReport(report, name), [report, name]);
  const build = useCallback(() => stringifyReport(fidelity), [fidelity]);
  const copy = useCopyReport(build, 'Copied report');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-md font-medium text-ink">{summaryText(report)}</p>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void copy.copy();
          }}
        >
          <Copy />
          Copy report
        </Button>
      </div>
      <FidelityGroups
        entries={fidelity.items.map((item) => ({ group: item.group, entry: item }))}
        renderGroup={(items) => <ItemRows items={items} />}
      />
      {copy.text !== null && <CopyFallback text={copy.text} label="Report as JSON" />}
    </div>
  );
}
