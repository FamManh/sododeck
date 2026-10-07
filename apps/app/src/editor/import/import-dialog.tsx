import { serializeDeck } from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import { Checkbox } from '@sododeck/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { RadioGroup, RadioGroupItem } from '@sododeck/ui/components/radio-group';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { useToast } from '@sododeck/ui/components/toast';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow } from '@xyflow/react';
import { ArrowLeftRight, CircleAlert, FileDown, FileUp, ScanSearch } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';

import { dialectName } from '../../db/export/schema-slice';
import { applyImport, importAsNewDeck } from '../../db/import/apply-import';
import { ImportCancelled } from '../../db/import/import-client';
import { placeImport } from '../../db/import/place-import';
import { plural } from '../../db/import/report-text';
import { remapSuggestions } from '../../db/import/suggest-fks';
import type { ImportPreview, ImportSource, SqlDialect } from '../../db/import/types';
import { createLayoutClient } from '../../layout/layout-client';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { LibraryUnavailableError, useDeckServices } from '../deck-services';
import { showUndoToast } from '../undo-toast';
import { useViewState } from '../views/use-current-view';
import { getImportClient } from './import-session';
import {
  existingRects,
  importTarget,
  newDeckName,
  targetContext,
  type TargetKind,
} from './import-target';
import { LOAD_FAILED, useImportPreview, type PreviewState } from './use-import-preview';

/** FR-001: at most 5 MB of text. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const ACCEPTED = /\.(sql|dbml|txt)$/i;
const DIALECTS: readonly SqlDialect[] = ['postgres', 'mysql', 'sqlite'];

type DialectChoice = 'auto' | SqlDialect;

/** The preview line (FR-003): counts, "Reading…", the empty hint or the first error. */
function previewText(state: PreviewState): { text: string; error: boolean } {
  switch (state.status) {
    case 'empty':
      return { text: 'Paste SQL or DBML, or drop a file', error: false };
    case 'reading':
      return { text: 'Reading…', error: false };
    case 'failed':
      return { text: state.message, error: true };
    case 'ready': {
      const { preview } = state;
      if (preview.error !== undefined) {
        return {
          text: `Line ${String(preview.error.line)}: ${preview.error.message}`,
          error: true,
        };
      }
      const { tables, relationships, enums } = preview.counts;
      const counts = `${plural(tables, 'table')}, ${plural(relationships, 'relationship')}, ${plural(enums, 'enum')}`;
      const skipped =
        preview.skippedCount === 0
          ? ''
          : ` · ${plural(preview.skippedCount, 'statement')} will be skipped`;
      return { text: `${counts}${skipped}`, error: false };
    }
  }
}

/** The dialect notice (FR-008, FR-009), or null. */
function dialectNotice(preview: ImportPreview, deckDialect: string): string[] | null {
  if (preview.dialectOutcome === 'keep-generic') {
    return ['This deck is Generic: types are kept as written.'];
  }
  if (preview.dialectOutcome !== 'convert' || preview.dialect === null) return null;
  const count = preview.conversions.reduce((n, c) => n + c.count, 0);
  const first = preview.conversions
    .slice(0, 3)
    .map((c) => `${c.from} → ${c.to}`)
    .join(', ');
  return [
    `This deck is ${dialectName(deckDialect as SqlDialect)}: ${plural(count, 'column type')} will be converted`,
    `${first === '' ? '' : `${first}. `}A new deck keeps ${dialectName(preview.dialect)}.`,
  ];
}

/**
 * The Import SQL or DBML dialog (044, frame 138, contracts/import-dialog-ui.md): paste text or
 * pick / drop one file, see what will come in, choose where it goes. Preparing never writes; Import
 * applies the whole plan as one undo step, or builds a new deck in the library.
 */
export function ImportDialog() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const view = useViewState();
  const { fitView } = useReactFlow();
  const services = useDeckServices();
  const toastApi = useToast();
  const returnFocus = useUiStore((s) => s.importDialog.returnFocus);
  const closeImport = useUiStore((s) => s.closeImport);
  const selection = useUiStore((s) => s.selection.nodes);
  const drill = useUiStore((s) => s.drill);
  const viewId = useUiStore((s) => s.currentViewId);
  const client = getImportClient();

  const context = useMemo(() => {
    const found = targetContext(deck, { selection, drill });
    // A new deck goes to the library, which only the web app has.
    return services === null
      ? { ...found, options: found.options.filter((option) => option.kind !== 'new-deck') }
      : found;
  }, [deck, selection, drill, services]);
  const [tab, setTab] = useState<'paste' | 'file'>('paste');
  const [pasted, setPasted] = useState('');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dialect, setDialect] = useState<DialectChoice>('auto');
  const [kind, setKind] = useState<TargetKind>(context.options[0]?.kind ?? 'deck');
  const [detectFk, setDetectFk] = useState(true);
  const [importing, setImporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const run = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const gutter = useRef<HTMLDivElement>(null);

  const text = tab === 'paste' ? pasted : (file?.text ?? '');
  const fileName = tab === 'file' ? file?.name : undefined;
  const source: ImportSource = useMemo(
    () => ({
      text,
      ...(fileName === undefined ? {} : { fileName }),
      format: 'auto',
      dialect,
      detectFk,
    }),
    [text, fileName, dialect, detectFk],
  );
  const cardId = kind === 'card' ? context.card?.cardId : undefined;
  const target = useMemo(() => importTarget(deck, kind, cardId), [deck, kind, cardId]);
  const preview = useImportPreview(client, source, target);
  const ready = preview.status === 'ready' ? preview.preview : null;
  const line = previewText(preview);
  const tables = ready?.counts.tables ?? 0;
  const canImport = ready !== null && ready.error === undefined && tables > 0 && !importing;
  const notice = ready === null ? null : dialectNotice(ready, target.deckDialect);
  const lineCount = Math.min(pasted.split('\n').length, 99_999);

  const close = () => {
    run.current++;
    client.cancel();
    closeImport();
    returnFocus?.focus();
  };

  const takeFile = async (picked: File | undefined) => {
    setTab('file');
    setFailure(null);
    if (picked === undefined) return;
    if (!ACCEPTED.test(picked.name)) {
      setFileError('Choose a .sql, .dbml or .txt file.');
      return;
    }
    if (picked.size > MAX_IMPORT_BYTES) {
      setFileError('This file is larger than 5 MB.');
      return;
    }
    setFileError(null);
    setFile({ name: picked.name, text: await picked.text() });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    void takeFile(event.dataTransfer.files[0]);
  };

  const runImport = async () => {
    if (!canImport) return;
    const mine = ++run.current;
    setImporting(true);
    setFailure(null);
    const layout = createLayoutClient();
    try {
      const plan = await client.plan(source, target);
      if (mine !== run.current) return;
      if (kind === 'new-deck') {
        const placement = await placeImport(plan, (r) => layout.layout(r), []);
        const file = importAsNewDeck(plan, placement, newDeckName(fileName));
        if (services === null) throw new LibraryUnavailableError();
        const id = await services.addDeckFromText(serializeDeck(file));
        if (mine !== run.current) return;
        const ui = useUiStore.getState();
        ui.setImportReport({ ...plan.report, suggestions: null, deckId: id, open: true });
        closeImport();
        toastApi.toast({
          message: `Imported ${plural(plan.report.mapped.tables, 'table')} into a new deck`,
        });
        services.openDeck(id);
        return;
      }
      const existing = existingRects(view.deck, cardId);
      const placement = await placeImport(plan, (r) => layout.layout(r), existing);
      if (mine !== run.current) return;
      const applied = applyImport(editor, plan, placement, {
        ...(cardId === undefined ? {} : { cardId }),
        ...(viewId === null ? {} : { viewId }),
      });
      const suggestions = source.detectFk
        ? remapSuggestions(plan.suggestions, applied.idMap).map((s) => ({
            ...s,
            state: 'open' as const,
          }))
        : null;
      const ui = useUiStore.getState();
      ui.setImportReport({ ...plan.report, suggestions, deckId: ui.shellDeckId });
      closeImport();
      const { tables: t, relationships, enums } = plan.report.mapped;
      showUndoToast(
        toastApi,
        editor,
        `Imported ${plural(t, 'table')}, ${plural(relationships, 'relationship')}, ${plural(enums, 'enum')}`,
      );
      ui.openFlyout('import-report');
      if (cardId === undefined) {
        requestAnimationFrame(() => {
          void fitView({ nodes: applied.nodes.map((id) => ({ id })), padding: 0.2, maxZoom: 1 });
        });
      }
    } catch (error) {
      if (error instanceof ImportCancelled || mine !== run.current) return;
      setFailure(error instanceof Error && error.message !== '' ? error.message : LOAD_FAILED);
    } finally {
      layout.terminate();
      if (mine === run.current) setImporting(false);
    }
  };

  const detected = ready?.detectedDialect ?? null;
  const autoLabel =
    ready?.format === 'dbml'
      ? 'DBML'
      : ready === null
        ? 'Auto'
        : detected === null
          ? 'Auto · not detected'
          : `Auto · ${dialectName(detected)} detected`;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="w-[720px] max-w-[calc(100vw-32px)] gap-0 p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={onDrop}
      >
        <DialogHeader className="px-6 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <FileDown aria-hidden className="size-4 text-ink-secondary" />
            Import SQL or DBML
          </DialogTitle>
          <DialogDescription>Paste statements or drop a .sql / .dbml file.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              aria-label="Source"
              value={tab}
              onValueChange={(value) => {
                setTab(value as 'paste' | 'file');
              }}
            >
              <SegmentedControlItem value="paste">Paste</SegmentedControlItem>
              <SegmentedControlItem value="file">File</SegmentedControlItem>
            </SegmentedControl>
            <Select
              value={dialect}
              disabled={ready?.format === 'dbml'}
              onValueChange={(value) => {
                setDialect(value as DialectChoice);
              }}
            >
              <SelectTrigger aria-label="Dialect" className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{autoLabel}</SelectItem>
                {DIALECTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {dialectName(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tab === 'paste' ? (
            <div className="flex h-56 overflow-hidden rounded-card border border-dashed border-border bg-surface-2 font-mono text-body-sm">
              <div
                ref={gutter}
                aria-hidden
                className="overflow-hidden py-3 pr-2 pl-3 text-right text-ink-muted select-none"
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                aria-label="SQL or DBML text"
                value={pasted}
                spellCheck={false}
                wrap="off"
                className="min-w-0 flex-1 resize-none bg-transparent py-3 pr-3 text-ink outline-none"
                onScroll={(event) => {
                  if (gutter.current !== null)
                    gutter.current.scrollTop = event.currentTarget.scrollTop;
                }}
                onChange={(event) => {
                  const next = event.target.value;
                  if (new Blob([next]).size > MAX_IMPORT_BYTES) {
                    setFailure('The text is larger than 5 MB.');
                    return;
                  }
                  setFailure(null);
                  setPasted(next);
                }}
              />
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface-2 text-center">
              <input
                ref={fileInput}
                type="file"
                accept=".sql,.dbml,.txt"
                hidden
                data-testid="import-file-input"
                onChange={(event) => {
                  void takeFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <FileUp aria-hidden className="size-6 text-ink-secondary" />
              <p className="text-body-sm text-ink-secondary">
                {file === null ? 'Drop a .sql, .dbml or .txt file here (5 MB at most)' : file.name}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  fileInput.current?.click();
                }}
              >
                Choose file
              </Button>
              {fileError !== null && (
                <p role="alert" className="flex items-center gap-1.5 text-body-sm text-clay-ink">
                  <CircleAlert aria-hidden className="size-4" />
                  {fileError}
                </p>
              )}
            </div>
          )}

          <p
            role="status"
            aria-live="polite"
            className={cn(
              'flex items-center gap-2 rounded-card bg-surface-2 px-4 py-2.5 text-body-sm',
              line.error ? 'text-clay-ink' : 'text-ink',
            )}
          >
            {line.error ? (
              <CircleAlert aria-hidden className="size-4 shrink-0" />
            ) : (
              <ScanSearch aria-hidden className="size-4 shrink-0 text-ink-secondary" />
            )}
            {line.text}
          </p>

          {notice !== null && (
            <div className="flex gap-2 rounded-card bg-amber-soft px-4 py-3 text-body-sm text-amber-ink">
              <ArrowLeftRight aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">{notice[0]}</p>
                {notice[1] !== undefined && <p>{notice[1]}</p>}
              </div>
            </div>
          )}

          <RadioGroup
            aria-label="Import into"
            value={kind}
            className="grid grid-cols-2 gap-3 max-sm:grid-cols-1"
            onValueChange={(value) => {
              setKind(value as TargetKind);
            }}
          >
            {context.options.map((option) => (
              <RadioGroupItem
                key={option.kind}
                value={option.kind}
                label={option.label}
                className={cn(
                  'rounded-card border px-4 py-3',
                  kind === option.kind ? 'border-primary bg-primary-soft' : 'border-border',
                )}
              />
            ))}
          </RadioGroup>

          <Checkbox
            checked={detectFk}
            onCheckedChange={(checked) => {
              setDetectFk(checked === true);
            }}
            label="Detect foreign keys by name (customer_id → customers.id)"
          />

          {failure !== null && (
            <p role="alert" className="flex items-center gap-1.5 text-body-sm text-clay-ink">
              <CircleAlert aria-hidden className="size-4" />
              {failure}
            </p>
          )}
        </div>
        <DialogFooter className="border-t border-hairline px-6 py-4">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canImport}
            aria-busy={importing}
            onClick={() => {
              void runImport();
            }}
          >
            {importing ? 'Importing…' : `Import ${plural(tables, 'table')}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportDialog;
