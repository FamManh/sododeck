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
import { Textarea } from '@sododeck/ui/components/textarea';
import { useToast } from '@sododeck/ui/components/toast';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow } from '@xyflow/react';
import { FileUp } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { summaryText, type ImportReport } from '../../import-mermaid/import-report';
import { applyLayout, toLayoutRequest } from '../../import-mermaid/layout-input';
import { getLayoutClient } from '../../layout/layout-client';
import { ImportReportView } from '../../library/import-report-view';
import { mermaidErrorMessage } from '../../library/library-error-message';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { LibraryClientError, getLibraryClient } from '../../storage/library-client';
import { LibraryUnavailableError, useDeckServices } from '../deck-services';
import { showUndoToast } from '../undo-toast';
import { useViewState } from '../views/use-current-view';
import { applyMermaid, MermaidApplyError } from './apply-mermaid';
import { existingRects } from './import-target';

type MermaidTarget = 'deck' | 'new-deck';

const TARGETS: readonly { kind: MermaidTarget; label: string }[] = [
  { kind: 'deck', label: 'Import into this deck' },
  { kind: 'new-deck', label: 'New deck' },
];

type Done =
  | { kind: 'deck'; report: ImportReport }
  | { kind: 'new-deck'; report: ImportReport; deckId: string; name: string };

function failureText(error: unknown): string {
  if (error instanceof LibraryClientError) return mermaidErrorMessage(error);
  if (error instanceof MermaidApplyError || (error instanceof Error && error.message !== '')) {
    return error.message;
  }
  return mermaidErrorMessage(error);
}

/**
 * Import Mermaid from the editor: paste text or choose a file, then choose where it goes. The
 * library worker reads the text and the layout worker places a flowchart (nothing heavy on the
 * main thread); "Import into this deck" (the default) adds everything in one undo step, right of
 * what the canvas already shows; "New deck" adds a deck to the library, as the library's own
 * Import Mermaid does. Both end on the import report. Nothing leaves the browser.
 */
export function MermaidImportDialog() {
  const editor = useEditor();
  const view = useViewState();
  const { fitView } = useReactFlow();
  const services = useDeckServices();
  const toastApi = useToast();
  const returnFocus = useUiStore((s) => s.mermaidDialog.returnFocus);
  const closeDialog = useUiStore((s) => s.closeMermaidImport);
  const viewId = useUiStore((s) => s.currentViewId);

  const [text, setText] = useState('');
  const [kind, setKind] = useState<MermaidTarget>('deck');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const textId = useId();
  const errorId = useId();

  const close = () => {
    if (running) return;
    closeDialog();
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      if (kind === 'new-deck') {
        if (services === null) throw new LibraryUnavailableError();
        const result = await services.importMermaidAsNewDeck(text);
        setDone({ kind: 'new-deck', ...result });
        return;
      }
      const { file: read, report, direction } = await getLibraryClient().importMermaid(text);
      const placed =
        direction === null
          ? read
          : applyLayout(read, await getLayoutClient().layout(toLayoutRequest(read, direction)));
      const applied = applyMermaid(editor, placed, {
        existing: existingRects(view.deck),
        ...(viewId === null ? {} : { viewId }),
      });
      setDone({ kind: 'deck', report });
      showUndoToast(toastApi, editor, `Imported ${summaryText(report)}`);
      requestAnimationFrame(() => {
        void fitView({ nodes: applied.nodes.map((id) => ({ id })), padding: 0.2, maxZoom: 1 });
      });
    } catch (caught) {
      setError(failureText(caught));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-w-xl"
        // The form swaps for the report and the focused Import button leaves the page: that is
        // not the user clicking away, so it must not close the dialog.
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          // The dialog unmounts on close: send focus back to whatever opened it, once the focus
          // trap has let go.
          event.preventDefault();
          if (returnFocus?.isConnected === true) returnFocus.focus();
        }}
      >
        {done !== null ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {done.kind === 'deck' ? 'Imported into this deck' : `Imported “${done.name}”`}
              </DialogTitle>
              <DialogDescription>
                {done.kind === 'deck'
                  ? 'Undo removes the whole import in one step.'
                  : 'The new deck is in your library.'}
              </DialogDescription>
            </DialogHeader>
            <ImportReportView report={done.report} />
            <DialogFooter>
              <Button
                type="button"
                variant={done.kind === 'deck' ? 'primary' : 'secondary'}
                onClick={close}
              >
                Done
              </Button>
              {done.kind === 'new-deck' && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    closeDialog();
                    services?.openDeck(done.deckId);
                  }}
                >
                  Open deck
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Import Mermaid</DialogTitle>
              <DialogDescription>
                Paste a flowchart or sequence diagram, or choose a file. Nothing leaves this
                browser.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={textId} className="text-body-sm font-medium text-ink-secondary">
                Mermaid diagram
              </label>
              <Textarea
                id={textId}
                value={text}
                rows={10}
                spellCheck={false}
                disabled={running}
                aria-invalid={error !== null}
                aria-describedby={error === null ? undefined : errorId}
                placeholder={'flowchart LR\n  A[Web app] --> B(API)'}
                onChange={(event) => {
                  setText(event.target.value);
                  setError(null);
                }}
              />
              {error !== null && (
                <p id={errorId} role="alert" className="text-body-sm text-clay-ink">
                  {error}
                </p>
              )}
            </div>
            {/* A new deck goes to the library, which only the web app has. */}
            {services !== null && (
              <RadioGroup
                aria-label="Import into"
                value={kind}
                className="grid grid-cols-2 gap-3 max-sm:grid-cols-1"
                onValueChange={(value) => {
                  setKind(value === 'new-deck' ? 'new-deck' : 'deck');
                }}
              >
                {TARGETS.map((option) => (
                  <RadioGroupItem
                    key={option.kind}
                    value={option.kind}
                    label={option.label}
                    disabled={running}
                    className={cn(
                      'rounded-card border px-4 py-3',
                      kind === option.kind ? 'border-primary bg-primary-soft' : 'border-border',
                    )}
                  />
                ))}
              </RadioGroup>
            )}
            <input
              ref={file}
              type="file"
              accept=".mmd,.mermaid,.md,.txt,text/plain"
              hidden
              data-testid="mermaid-file-input"
              onChange={(event) => {
                const [chosen] = event.target.files ?? [];
                event.target.value = '';
                if (chosen === undefined) return;
                void chosen.text().then((content) => {
                  setText(content);
                  setError(null);
                });
              }}
            />
            <DialogFooter>
              <Button
                type="button"
                disabled={running}
                onClick={() => {
                  file.current?.click();
                }}
              >
                <FileUp />
                Choose file
              </Button>
              <Button type="button" disabled={running} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={running || text.trim() === ''}>
                {running ? 'Importing…' : 'Import'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
