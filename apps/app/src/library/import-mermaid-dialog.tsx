import { Button } from '@sododeck/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { Textarea } from '@sododeck/ui/components/textarea';
import { FileUp } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { importMermaidDeck, type MermaidImportResult } from './library-actions';
import { mermaidErrorMessage } from './library-error-message';
import { ImportReportView } from './import-report-view';
import type { LibraryCommands } from './use-library-commands';

/** Opening the dialog: with `autoRun`, the text is imported straight away (a dropped file). */
export interface MermaidDialogRequest {
  key: number;
  text: string;
  autoRun: boolean;
  /** What had focus when it opened: focus goes back there on close. */
  opener: Element | null;
}

function MermaidImportForm({
  commands,
  folderId,
  request,
  onBusyChange,
  onClose,
}: {
  commands: LibraryCommands | null;
  folderId: string | null;
  request: MermaidDialogRequest;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [text, setText] = useState(request.text);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MermaidImportResult | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const textId = useId();
  const errorId = useId();

  const run = async (source: string) => {
    if (commands === null) return;
    onBusyChange(true);
    setRunning(true);
    setError(null);
    try {
      setResult(await importMermaidDeck(commands.ctx, source, folderId));
    } catch (caught) {
      setError(mermaidErrorMessage(caught));
    } finally {
      onBusyChange(false);
      setRunning(false);
    }
  };

  useEffect(() => {
    if (request.autoRun && !started.current) {
      started.current = true;
      void run(request.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open: the form remounts for every request
  }, []);

  if (result !== null) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Imported “{result.name}”</DialogTitle>
          <DialogDescription>The new deck is in your library.</DialogDescription>
        </DialogHeader>
        <ImportReportView report={result.report} />
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              void navigate(`/deck/${result.deckId}`);
            }}
          >
            Open deck
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void run(text);
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>Import Mermaid</DialogTitle>
        <DialogDescription>
          Paste a flowchart or sequence diagram, or choose a file. It becomes a new deck; nothing
          leaves this browser.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={textId} className="text-body-sm font-medium text-ink-secondary">
          Mermaid diagram
        </label>
        <Textarea
          id={textId}
          value={text}
          rows={12}
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
      <input
        ref={file}
        type="file"
        accept=".mmd,.mermaid,.md,.txt,text/plain"
        hidden
        data-testid="import-mermaid-input"
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
        <Button type="button" disabled={running} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={running || commands === null}>
          {running ? 'Importing…' : 'Import'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Import Mermaid (056 R7): paste text or choose a file, then see what was mapped and skipped. A
 * refused text keeps what was typed and shows why, inline. The form mounts with the dialog, so
 * every opening starts from its request. The dialog cannot be closed while an import runs.
 */
export function ImportMermaidDialog({
  commands,
  folderId,
  request,
  onClose,
}: {
  commands: LibraryCommands | null;
  folderId: string | null;
  request: MermaidDialogRequest | null;
  onClose: () => void;
}) {
  const busy = useRef(false);
  // `request` is already null when the dialog finishes closing: remember who opened it.
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (request !== null) opener.current = request.opener;
  }, [request]);
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !busy.current) onClose();
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
          // No trigger element: send focus back to whatever opened the dialog.
          const back = opener.current;
          if (back instanceof HTMLElement && back.isConnected) {
            event.preventDefault();
            back.focus();
          }
        }}
      >
        {request !== null && (
          <MermaidImportForm
            key={request.key}
            commands={commands}
            folderId={folderId}
            request={request}
            onBusyChange={(value) => {
              busy.current = value;
            }}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
