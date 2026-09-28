import { Button } from '@sododeck/ui/components/button';
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
import { Switch } from '@sododeck/ui/components/switch';
import { useToast } from '@sododeck/ui/components/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { cn } from '@sododeck/ui/lib/utils';
import { Download, FileText } from 'lucide-react';
import { useEffect, useId, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';

import { copyText } from '../../lib/clipboard';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { downloadBlob, downloadText } from '../../storage/download';
import { focusCanvas } from '../canvas-actions';
import { useSaveControls } from '../save-context';
import { exportReducer, initialExportState, type ExportResult } from './export-dialog-state';
import { FORMATS } from './formats';
import { scaleAllowed } from './png-size';
import { rasterize } from './rasterize';
import type { ExportFormat, ImageScope, PngScale } from './types';
import { exportRequest, exportRequestKey, pngSizeHint, useExportResult } from './use-export-result';

const JSON_PREVIEW_LINES = 400;
const FLOW_DELETED = 'The flow was deleted, so the whole deck is shown.';
const FAILED = "Couldn't create this export";

/**
 * A disabled segmented item with the reason as a tooltip (hover) and as its description
 * (screen readers). Disabled radios cannot take focus, so the reason is not keyboard-reachable
 * as a tooltip; the description carries it instead.
 */
function DisabledReason({ reason, children }: { reason: string | null; children: ReactNode }) {
  const id = useId();
  if (reason === null) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-full w-full" aria-describedby={id}>
          {children}
          <span id={id} className="sr-only">
            {reason}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function OptionSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-body-sm text-ink">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

/**
 * The Export dialog (012, ADR 0016): JSON of the whole deck, or a PNG / SVG picture of the
 * whole deck, the current view or the shown flow. It only reads the deck; nothing is uploaded.
 */
export function ExportDialog() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const returnFocus = useUiStore((s) => s.exportDialog.returnFocus);
  const closeExport = useUiStore((s) => s.closeExport);
  const announceLive = useUiStore((s) => s.announce);
  const { markExported } = useSaveControls();
  const { toast } = useToast();
  const [state, dispatch] = useReducer(exportReducer, undefined, () =>
    initialExportState({ flowMode: isFlowMode(useUiStore.getState()) }),
  );
  const currentViewId = useUiStore((s) => s.currentViewId);
  const revealed = useUiStore((s) => s.revealed);
  const drill = useUiStore((s) => s.drill);
  const activeFlowId = useUiStore((s) => s.activeFlow?.flowId ?? null);
  const notesDisplay = useUiStore((s) => s.notesDisplay);
  const ui = useMemo(
    () => ({ currentViewId, revealed, drill, activeFlowId, notesDisplay }),
    [currentViewId, revealed, drill, activeFlowId, notesDisplay],
  );
  const request = exportRequest(state);
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

  const flowGone =
    state.imageScope === 'flow' && !deck.flows.some((flow) => flow.id === activeFlowId);
  useEffect(() => {
    if (!flowGone) return;
    dispatch({ type: 'flowGone' });
    announceLive(FLOW_DELETED);
  }, [flowGone, announceLive]);

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
        ? ready.text.split('\n', JSON_PREVIEW_LINES).join('\n')
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
    if (ready === null || ready.text === null) return;
    tell((await copyText(ready.text)) ? 'Copied' : "Couldn't copy — use Download instead");
  };
  const download = async () => {
    if (ready === null) return;
    if (state.format === 'png') {
      if (ready.svg === null || ready.bounds === null || pngBlocked) return;
      setRasterizing(true);
      try {
        downloadBlob(ready.fileName, await rasterize(ready.svg, ready.bounds, scale));
      } catch {
        tell(FAILED);
        return;
      } finally {
        setRasterizing(false);
      }
    } else if (ready.text !== null) {
      downloadText(
        ready.fileName,
        ready.text,
        state.format === 'svg' ? 'image/svg+xml' : 'application/json',
      );
      // Only a JSON file is a backup (005's "last export").
      if (state.format === 'json') markExported();
    }
    tell(`Downloaded ${ready.fileName}`);
  };

  const isJson = state.format === 'json';
  const flowReason = state.flowAvailable ? null : 'Open a flow to export it';

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
              className="gap-2"
              onValueChange={(value) => {
                dispatch({ type: 'format', format: value as ExportFormat });
              }}
            >
              {FORMATS.map(({ id, label, subtitle, icon: Icon }) => (
                <div
                  key={id}
                  className={cn(
                    'rounded-row border p-3',
                    state.format === id ? 'border-primary bg-primary-soft' : 'border-border',
                  )}
                >
                  <RadioGroupItem
                    ref={state.format === id ? checkedFormat : undefined}
                    value={id}
                    aria-label={label}
                    aria-describedby={`export-format-${id}`}
                    label={
                      <span className="flex items-center gap-2 font-medium">
                        <Icon aria-hidden className="size-4 text-ink-secondary" />
                        {label}
                      </span>
                    }
                  />
                  <p
                    id={`export-format-${id}`}
                    className="mt-1 pl-6 text-caption text-ink-secondary"
                  >
                    {subtitle}
                  </p>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="flex min-w-0 flex-col gap-4 p-5">
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
                value={isJson ? 'deck' : state.imageScope}
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
                <DisabledReason reason={isJson ? null : flowReason}>
                  <SegmentedControlItem
                    value="flow"
                    className="w-full"
                    disabled={!state.flowAvailable}
                  >
                    Selected flow
                  </SegmentedControlItem>
                </DisabledReason>
              </SegmentedControl>
              {isJson && (
                <p id="export-scope-note" className="text-caption text-ink-secondary">
                  JSON always contains the whole deck
                </p>
              )}
              {!isJson && state.scopeNote === 'flow-deleted' && (
                <p className="text-caption text-ink-secondary">{FLOW_DELETED}</p>
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
                      dispatch({ type: 'option', options: { json: { includeKnowledge: value } } });
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
          {state.format !== 'png' && (
            <Button
              variant="secondary"
              disabled={ready === null || ready.text === null}
              onClick={() => {
                void copy();
              }}
            >
              Copy
            </Button>
          )}
          <Button
            variant="primary"
            disabled={ready === null || rasterizing || pngBlocked}
            aria-busy={rasterizing}
            onClick={() => {
              void download();
            }}
          >
            <Download aria-hidden />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportDialog;
