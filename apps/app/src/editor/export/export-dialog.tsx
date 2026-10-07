import { Button } from '@sododeck/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { RadioGroup } from '@sododeck/ui/components/radio-group';
import { deckDialect } from '@sododeck/model';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { useToast } from '@sododeck/ui/components/toast';
import { cn } from '@sododeck/ui/lib/utils';
import { Download, FileText } from 'lucide-react';
import { useMemo, useReducer, useRef, useState } from 'react';

import { copyText } from '../../lib/clipboard';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { focusCanvas } from '../canvas-actions';
import { useSaveFile } from '../embed-host-context';
import { useSaveControls } from '../save-context';
import {
  availableSchemaScopes,
  defaultSchemaScope,
  tablesInScope,
  type SchemaScopes,
} from '../../db/export/scope';
import { dialectName, isSqlDialect } from '../../db/export/schema-slice';
import type { SchemaScopeRequest } from '../../db/export/types';
import { useProblems } from '../problems/use-problems';
import { DisabledReason } from './disabled-reason';
import { FormatGroup } from './format-group';
import { exportReducer, initialExportState, type ExportResult } from './export-dialog-state';
import { IMAGE_AND_DATA_FORMATS, SCHEMA_FORMATS, sqlSubtitle } from './formats';
import { OptionSwitch } from './option-switch';
import { scaleAllowed } from './png-size';
import { copyImage } from './copy-image';
import { rasterize } from './rasterize';
import { schemaProblems } from './schema-problems';
import { SQL_BLOCKED_BANNER_ID, SchemaExportPanel } from './schema-export-panel';
import {
  isSchemaFormat,
  type ExportFormat,
  type ImageScope,
  type PngScale,
  type SchemaScope,
} from './types';
import {
  exportRequest,
  exportRequestKey,
  pngSizeHint,
  useExportResult,
  type SchemaRequest,
} from './use-export-result';

const JSON_PREVIEW_LINES = 400;
/** A picture's base64 is one line of millions of characters; the preview shows its start only. */
const JSON_PREVIEW_WIDTH = 240;
const NOTHING_SELECTED = 'Select something on the canvas to export it';
const FAILED = "Couldn't create this export";

/**
 * The Export dialog (012, ADR 0016): JSON of the whole deck, or a PNG / SVG picture of the
 * whole deck, the current view or the selection; and, when the deck has tables, its schema as
 * SQL, DBML, Mermaid ER or a data dictionary (045). It only reads the deck; nothing is uploaded.
 */
export function ExportDialog() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const returnFocus = useUiStore((s) => s.exportDialog.returnFocus);
  const closeExport = useUiStore((s) => s.closeExport);
  const announceLive = useUiStore((s) => s.announce);
  const { markExported } = useSaveControls();
  const saveFile = useSaveFile();
  const { toast } = useToast();
  const selectedNodes = useUiStore((s) => s.selection.nodes);
  const selectedGroups = useUiStore((s) => s.selection.groups);
  const selectedStickies = useUiStore((s) => s.selection.stickies);
  const selectedImages = useUiStore((s) => s.selection.images);
  // Connectors alone draw nothing (they need both ends), so they do not count.
  const hasSelection =
    selectedNodes.length + selectedGroups.length + selectedStickies.length + selectedImages.length >
    0;
  const drill = useUiStore((s) => s.drill);
  const scopes: SchemaScopes = useMemo(
    () => availableSchemaScopes(deck, { selection: selectedNodes, drill }),
    [deck, selectedNodes, drill],
  );
  const [state, dispatch] = useReducer(exportReducer, undefined, () => {
    const seed = useUiStore.getState().exportDialog.seed;
    return initialExportState({
      flowMode: isFlowMode(useUiStore.getState()),
      // A seed (043) picks its scope when that scope has something to export.
      schemaScope:
        seed?.scope === 'selection' && scopes.selection.length > 0
          ? 'selection'
          : seed?.scope === 'database' && scopes.database !== null
            ? 'database'
            : defaultSchemaScope(scopes),
      ...(seed === undefined ? {} : { format: seed.format }),
    });
  });
  const currentViewId = useUiStore((s) => s.currentViewId);
  const revealed = useUiStore((s) => s.revealed);
  const activeFlowId = useUiStore((s) => s.activeFlow?.flowId ?? null);
  const labelsOn = useUiStore((s) => s.labelsOn);
  const ui = useMemo(
    () => ({
      currentViewId,
      revealed,
      drill,
      activeFlowId,
      labelsOn,
      selection: {
        nodes: selectedNodes,
        groups: selectedGroups,
        stickies: selectedStickies,
        images: selectedImages,
      },
    }),
    [
      currentViewId,
      revealed,
      drill,
      activeFlowId,
      labelsOn,
      selectedNodes,
      selectedGroups,
      selectedStickies,
      selectedImages,
    ],
  );
  // "Selected" with nothing selected (the selection was deleted meanwhile) draws the whole deck.
  const imageScope: ImageScope =
    state.imageScope === 'selection' && !hasSelection ? 'deck' : state.imageScope;
  const dialect = deckDialect(deck);
  // The chosen schema scope, or the first available one when it no longer is (FR-002).
  const schemaScope: SchemaScope =
    (state.schemaScope === 'selection' && scopes.selection.length === 0) ||
    (state.schemaScope === 'database' && scopes.database === null)
      ? defaultSchemaScope(scopes)
      : state.schemaScope;
  const schemaFormat = isSchemaFormat(state.format) ? state.format : null;
  const schema: SchemaRequest | null = useMemo(() => {
    if (schemaFormat === null) return null;
    const scope: SchemaScopeRequest =
      schemaScope === 'selection'
        ? { kind: 'selection', tableIds: scopes.selection }
        : schemaScope === 'database' && scopes.database !== null
          ? { kind: 'database', cardId: scopes.database.cardId }
          : { kind: 'deck' };
    const generic = !isSqlDialect(dialect);
    return {
      request: {
        format: schemaFormat,
        scope,
        dialect: generic ? state.sqlDialect : null,
        sql: state.options.sql,
      },
      scopeTitle: scope.kind === 'database' ? (scopes.database?.title ?? null) : null,
      needsDialect: schemaFormat === 'sql' && generic && state.sqlDialect === null,
    };
  }, [schemaFormat, schemaScope, scopes, dialect, state.sqlDialect, state.options.sql]);
  const tableIds = useMemo(
    () => (schema === null ? [] : tablesInScope(deck, schema.request.scope)),
    [deck, schema],
  );
  const problems = schemaProblems(useProblems(), tableIds, deck);
  // 052: the deck's switch refuses SQL while the scope has database errors; other formats export.
  const sqlBlocked =
    deck.blockSqlExport === true && schemaFormat === 'sql' && problems.errors.length > 0;
  const request = exportRequest({ ...state, imageScope }, schema);
  useExportResult(request, dispatch, deck, ui);
  const key = exportRequestKey(request, deck, ui);
  const ready: ExportResult | null =
    state.result.status === 'ready' && state.result.key === key ? state.result.result : null;
  // A result settled for an older request counts as still preparing the current one.
  const status =
    ready !== null ? 'ready' : state.result.key === key ? state.result.status : 'preparing';
  const busy = status === 'preparing';
  const [rasterizing, setRasterizing] = useState(false);
  const checkedFormat = useRef<HTMLButtonElement>(null);

  const previewSrc = useMemo(
    () =>
      ready === null || ready.svg === null
        ? null
        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ready.svg)}`,
    [ready],
  );
  const jsonPreview = useMemo(
    () =>
      state.format === 'json' && ready !== null && ready.text !== null
        ? ready.text
            .split('\n', JSON_PREVIEW_LINES)
            .map((line) =>
              line.length > JSON_PREVIEW_WIDTH ? `${line.slice(0, JSON_PREVIEW_WIDTH)}…` : line,
            )
            .join('\n')
        : null,
    [state.format, ready],
  );

  const scale = state.options.png.scale;
  const bounds = ready?.bounds ?? null;
  const sizeHint =
    ready === null
      ? null
      : state.format === 'png' && bounds
        ? pngSizeHint(bounds, scale)
        : ready.sizeHint;
  const pngBlocked = state.format === 'png' && bounds !== null && !scaleAllowed(bounds, scale);

  const tell = (message: string) => {
    toast({ message });
    announceLive(message);
  };
  const close = () => {
    closeExport();
    globalThis.setTimeout(() => {
      if (returnFocus?.isConnected === true) returnFocus.focus();
      else focusCanvas();
    }, 0);
  };
  const copy = async () => {
    if (ready === null) return;
    const { format } = state;
    // Pictures go through the same path as the canvas menu's Copy as PNG / SVG.
    const ok =
      (format === 'png' || format === 'svg') && ready.svg !== null && ready.bounds !== null
        ? await copyImage(format, Promise.resolve({ svg: ready.svg, bounds: ready.bounds }), scale)
        : ready.text !== null && (await copyText(ready.text));
    tell(
      ok ? 'Copied' : saveFile === null ? "Couldn't copy" : "Couldn't copy — use Download instead",
    );
  };
  const download = async () => {
    if (ready === null || saveFile === null) return;
    if (state.format === 'png') {
      if (ready.svg === null || ready.bounds === null || pngBlocked) return;
      setRasterizing(true);
      try {
        saveFile(ready.fileName, await rasterize(ready.svg, ready.bounds, scale));
      } catch {
        tell(FAILED);
        return;
      } finally {
        setRasterizing(false);
      }
    } else if (ready.text !== null) {
      const mime =
        state.format === 'svg'
          ? 'image/svg+xml'
          : schemaFormat !== null
            ? 'text/plain'
            : 'application/json';
      saveFile(ready.fileName, new Blob([ready.text], { type: mime }));
      // Only a JSON file is a backup (005's "last export").
      if (state.format === 'json') markExported();
    }
    tell(`Downloaded ${ready.fileName}`);
  };

  const isJson = state.format === 'json';
  const scopeName =
    schemaScope === 'selection'
      ? 'the selection'
      : schemaScope === 'database'
        ? (scopes.database?.title ?? 'the database')
        : 'the deck';
  const selectionReason = hasSelection ? null : NOTHING_SELECTED;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="w-[820px] max-w-[calc(100vw-32px)] gap-0 p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          checkedFormat.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader className="border-b border-hairline px-6 py-5">
          <DialogTitle>Export deck</DialogTitle>
          <DialogDescription>
            Exports are generated in your browser. Nothing is uploaded.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[280px_minmax(0,1fr)] max-sm:grid-cols-1">
          <div className="border-r border-hairline p-4 max-sm:border-r-0 max-sm:border-b">
            <RadioGroup
              aria-label="Format"
              value={state.format}
              className="gap-4"
              onValueChange={(value) => {
                dispatch({ type: 'format', format: value as ExportFormat });
              }}
            >
              {scopes.deckHasTables && (
                <FormatGroup
                  label="Schema"
                  formats={SCHEMA_FORMATS.map((f) =>
                    f.id === 'sql'
                      ? {
                          ...f,
                          subtitle: sqlSubtitle(
                            isSqlDialect(dialect) ? dialectName(dialect) : null,
                          ),
                        }
                      : f,
                  )}
                  checked={state.format}
                  checkedRef={checkedFormat}
                />
              )}
              <FormatGroup
                label="Image and data"
                formats={IMAGE_AND_DATA_FORMATS}
                checked={state.format}
                checkedRef={checkedFormat}
              />
            </RadioGroup>
          </div>
          <div className="flex min-w-0 flex-col gap-4 p-5">
            {schemaFormat !== null ? (
              <SchemaExportPanel
                state={state}
                dispatch={dispatch}
                scopes={scopes}
                scope={schemaScope}
                scopeName={scopeName}
                problems={problems}
                blocked={sqlBlocked}
                dialect={dialect}
                status={status}
                ready={ready}
              />
            ) : (
              <>
                <section className="flex flex-col gap-2">
                  <h3
                    id="export-scope-heading"
                    className="text-micro font-medium tracking-[0.07em] text-ink-muted uppercase"
                  >
                    Scope
                  </h3>
                  <SegmentedControl
                    aria-labelledby="export-scope-heading"
                    aria-describedby={isJson ? 'export-scope-note' : undefined}
                    value={isJson ? 'deck' : imageScope}
                    disabled={isJson}
                    className="grid h-9 w-full grid-cols-3"
                    onValueChange={(value) => {
                      dispatch({ type: 'scope', scope: value as ImageScope });
                    }}
                  >
                    <SegmentedControlItem value="deck" className="w-full">
                      Whole deck
                    </SegmentedControlItem>
                    <SegmentedControlItem value="view" className="w-full">
                      Current view
                    </SegmentedControlItem>
                    <DisabledReason reason={isJson ? null : selectionReason}>
                      <SegmentedControlItem
                        value="selection"
                        className="w-full"
                        disabled={!hasSelection}
                      >
                        Selected
                      </SegmentedControlItem>
                    </DisabledReason>
                  </SegmentedControl>
                  {isJson && (
                    <p id="export-scope-note" className="text-caption text-ink-secondary">
                      JSON always contains the whole deck
                    </p>
                  )}
                </section>
                <div
                  role="region"
                  aria-label="Preview"
                  className="flex h-62.5 min-w-0 flex-col overflow-auto rounded-row border border-hairline bg-canvas"
                >
                  {status === 'error' && (
                    <div className="m-auto flex flex-col items-center gap-2 text-body-sm text-ink-secondary">
                      <p>{FAILED}</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          dispatch({ type: 'retry' });
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                  {status === 'empty' && (
                    <p className="m-auto text-body-sm text-ink-secondary">Nothing to export yet</p>
                  )}
                  {jsonPreview !== null && (
                    <pre className="p-3 font-mono text-caption whitespace-pre text-ink">
                      {jsonPreview}
                    </pre>
                  )}
                  {!isJson && previewSrc !== null && ready !== null && (
                    <img
                      src={previewSrc}
                      alt={`Preview of ${ready.fileName}`}
                      className="size-full object-contain p-3"
                    />
                  )}
                  <p
                    role="status"
                    aria-live="polite"
                    className={cn(busy ? 'm-auto text-body-sm text-ink-secondary' : 'sr-only')}
                  >
                    {busy ? 'Preparing…' : ''}
                  </p>
                </div>
                <section className="flex flex-col gap-3" aria-label="Options">
                  {isJson && (
                    <>
                      <OptionSwitch
                        label="Include descriptions, links and rules"
                        checked={state.options.json.includeKnowledge}
                        onChange={(value) => {
                          dispatch({
                            type: 'option',
                            options: { json: { includeKnowledge: value } },
                          });
                        }}
                      />
                      <OptionSwitch
                        label="Pretty-print"
                        checked={state.options.json.pretty}
                        onChange={(value) => {
                          dispatch({ type: 'option', options: { json: { pretty: value } } });
                        }}
                      />
                    </>
                  )}
                  {state.format === 'png' && (
                    <div className="flex items-center justify-between gap-3 text-body-sm text-ink">
                      <span id="export-scale-label">Scale</span>
                      <SegmentedControl
                        aria-labelledby="export-scale-label"
                        value={String(scale)}
                        onValueChange={(value) => {
                          dispatch({
                            type: 'option',
                            options: { png: { scale: Number(value) as PngScale } },
                          });
                        }}
                      >
                        {([1, 2, 3] as const).map((option) => {
                          const tooLarge = bounds !== null && !scaleAllowed(bounds, option);
                          return (
                            <DisabledReason
                              key={option}
                              reason={tooLarge ? 'Too large for this browser' : null}
                            >
                              <SegmentedControlItem value={String(option)} disabled={tooLarge}>
                                {option}×
                              </SegmentedControlItem>
                            </DisabledReason>
                          );
                        })}
                      </SegmentedControl>
                    </div>
                  )}
                  {!isJson && (
                    <OptionSwitch
                      label="Transparent background"
                      checked={
                        state.format === 'png'
                          ? state.options.png.transparent
                          : state.options.svg.transparent
                      }
                      onChange={(value) => {
                        dispatch({
                          type: 'option',
                          options:
                            state.format === 'png'
                              ? { png: { transparent: value } }
                              : { svg: { transparent: value } },
                        });
                      }}
                    />
                  )}
                </section>
              </>
            )}
          </div>
        </div>
        <DialogFooter className="flex-nowrap border-t border-hairline px-6 py-4">
          <div className="mr-auto flex min-w-0 items-center gap-2 text-body-sm">
            <FileText aria-hidden className="size-4 shrink-0 text-ink-secondary" />
            <span className="truncate font-mono text-ink">{ready?.fileName ?? ''}</span>
          </div>
          {sizeHint !== null && (
            <span className="shrink-0 text-body-sm text-ink-secondary">{sizeHint}</span>
          )}
          <Button
            variant="secondary"
            disabled={
              ready === null ||
              (ready.text === null && ready.svg === null) ||
              rasterizing ||
              pngBlocked ||
              sqlBlocked
            }
            aria-describedby={sqlBlocked ? SQL_BLOCKED_BANNER_ID : undefined}
            onClick={() => {
              void copy();
            }}
          >
            Copy
          </Button>
          {/* No download without a way to save: the host of an embed may not offer one (067). */}
          {saveFile !== null && (
            <Button
              variant="primary"
              disabled={ready === null || rasterizing || pngBlocked || sqlBlocked}
              aria-describedby={sqlBlocked ? SQL_BLOCKED_BANNER_ID : undefined}
              aria-busy={rasterizing}
              onClick={() => {
                void download();
              }}
            >
              <Download aria-hidden />
              Download
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportDialog;
