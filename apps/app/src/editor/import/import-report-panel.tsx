import type { Id, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { Check, Link2, ListTree, Table2, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { collapseSkipped, plural, skipText } from '../../db/import/report-text';
import type { FkSuggestion, ImportReport } from '../../db/import/types';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';

type Suggestion = NonNullable<ImportReport['suggestions']>[number];

/** A suggestion counts as added only while its relationship is still in the deck (Undo reopens it). */
function isAdded(s: Suggestion, edges: ReadonlySet<Id>): boolean {
  return s.state === 'accepted' && s.edgeId !== undefined && edges.has(s.edgeId);
}

function relationshipOf(s: FkSuggestion) {
  return {
    from: s.fromTable,
    to: s.toTable,
    fromColumns: [s.fromColumn],
    toColumns: [s.toColumn],
    cardinality: s.cardinality,
    ...(s.fromOptional ? { fromOptional: true } : {}),
  };
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-body-sm text-ink">
      {icon}
      {children}
    </li>
  );
}

/**
 * The Import report (044 FR-023, FR-025, frame 139): what was mapped, skipped and changed, and the
 * foreign keys found by name. UI state only; reopened from the ≡ menu until the deck closes.
 * Accepting a suggestion adds the relationship as one undo step; hovering or focusing one lights
 * its column row on the canvas (042's row highlight).
 */
export function ImportReportPanel({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const report = useUiStore((s) => s.importReport);
  const updateSuggestion = useUiStore((s) => s.updateSuggestion);
  const setHoverFocus = useUiStore((s) => s.setHoverFocus);
  const clearHoverFocus = useUiStore((s) => s.clearHoverFocus);

  if (report === null) {
    return (
      <PanelSection>
        <p className="text-body-sm text-ink-secondary">No import in this deck yet.</p>
      </PanelSection>
    );
  }
  const edges = new Set(deck.edges.map((e) => e.id));
  const { mapped } = report;
  const suggestions = report.suggestions;
  const open = (suggestions ?? []).flatMap((s, i) =>
    s.state === 'dismissed' || isAdded(s, edges) ? [] : [i],
  );

  const accept = (indexes: readonly number[]) => {
    if (suggestions === null || indexes.length === 0) return;
    const ids = editor.batch(() =>
      indexes.flatMap((i) => {
        const s = suggestions[i];
        return s === undefined ? [] : [[i, editor.add('edges', relationshipOf(s))] as const];
      }),
    );
    for (const [i, id] of ids) updateSuggestion(i, 'accepted', id);
  };
  const dismiss = (indexes: readonly number[]) => {
    for (const i of indexes) updateSuggestion(i, 'dismissed');
  };
  const highlight = (s: Suggestion) => {
    setHoverFocus({
      id: s.fromTable,
      source: 'column',
      column: { tableId: s.fromTable, columnId: s.fromColumn },
    });
  };

  return (
    <>
      <PanelSection label="Mapped">
        <ul aria-label="Mapped" className="flex flex-wrap gap-1.5">
          <Chip icon={<Table2 aria-hidden className="size-4 text-ink-secondary" />}>
            {plural(mapped.tables, 'table')}
          </Chip>
          <Chip icon={<Link2 aria-hidden className="size-4 text-ink-secondary" />}>
            {plural(mapped.relationships, 'relationship')}
          </Chip>
          <Chip icon={<ListTree aria-hidden className="size-4 text-ink-secondary" />}>
            {plural(mapped.enums, 'enum')}
          </Chip>
          <Chip icon={<ListTree aria-hidden className="size-4 text-ink-secondary" />}>
            {plural(mapped.indexes, 'index', 'indexes')}
          </Chip>
          {mapped.groups > 0 && <Chip icon={null}>{plural(mapped.groups, 'group')}</Chip>}
          {mapped.stickies > 0 && <Chip icon={null}>{plural(mapped.stickies, 'sticky note')}</Chip>}
        </ul>
      </PanelSection>

      {report.skipped.length > 0 && (
        <PanelSection label={`Skipped · ${String(report.skipped.length)}`}>
          <ul aria-label="Skipped" className="flex flex-col gap-2">
            {collapseSkipped(report.skipped).map((row, i) =>
              row.kind === 'entry' ? (
                <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-body-sm">
                  <span className="font-mono text-ink-muted">L{row.entry.line}</span>
                  <span className="truncate font-mono text-ink" title={row.entry.excerpt}>
                    {row.entry.excerpt}
                  </span>
                  <span />
                  <span className="text-ink-secondary">{skipText(row.entry)}</span>
                </li>
              ) : (
                <li key={i} className="text-body-sm text-ink-secondary">
                  {row.text}
                </li>
              ),
            )}
          </ul>
        </PanelSection>
      )}

      {report.changed.length > 0 && (
        <PanelSection label={`Changed · ${String(report.changed.length)}`}>
          <ul aria-label="Changed" className="flex flex-col gap-2">
            {report.changed.map((entry, i) => (
              <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-body-sm">
                <span className="font-mono text-ink-muted">
                  {entry.line === undefined ? '' : `L${String(entry.line)}`}
                </span>
                <span className="text-ink">{entry.detail}</span>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      {suggestions !== null && (
        <PanelSection
          label={`Foreign keys by name · ${String(suggestions.filter((s) => s.state !== 'dismissed').length)}`}
        >
          {suggestions.every((s) => s.state === 'dismissed') ? (
            <p className="text-body-sm text-ink-secondary">No suggestions.</p>
          ) : (
            <ul aria-label="Foreign keys by name" className="flex flex-col gap-1">
              {suggestions.map((s, i) =>
                s.state === 'dismissed' ? null : (
                  <li
                    key={i}
                    tabIndex={0}
                    aria-label={s.label}
                    className="flex items-center gap-2 rounded-row px-1 py-1 text-body-sm hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                    onPointerEnter={() => {
                      highlight(s);
                    }}
                    onPointerLeave={clearHoverFocus}
                    onFocus={() => {
                      highlight(s);
                    }}
                    onBlur={clearHoverFocus}
                  >
                    <span
                      className={
                        isAdded(s, edges)
                          ? 'min-w-0 flex-1 font-mono break-all text-ink-muted'
                          : 'min-w-0 flex-1 font-mono break-all text-ink'
                      }
                    >
                      {s.label}
                    </span>
                    {isAdded(s, edges) ? (
                      <span className="flex items-center gap-1 text-ink-muted">
                        <Check aria-hidden className="size-4" />
                        Added
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Accept ${s.label}`}
                          onClick={() => {
                            accept([i]);
                          }}
                        >
                          <Check />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Dismiss ${s.label}`}
                          onClick={() => {
                            dismiss([i]);
                          }}
                        >
                          <X />
                        </Button>
                      </>
                    )}
                  </li>
                ),
              )}
            </ul>
          )}
          {open.length > 0 && (
            <div className="mt-2 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  accept(open);
                }}
              >
                Accept all
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  dismiss(open);
                }}
              >
                Dismiss all
              </Button>
            </div>
          )}
        </PanelSection>
      )}
    </>
  );
}
