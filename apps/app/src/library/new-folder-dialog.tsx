import { Button } from '@sododeck/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { Input } from '@sododeck/ui/components/input';
import { useEffect, useId, useRef, useState } from 'react';

import {
  createFolder,
  FolderNameError,
  type FolderRecord,
  type LibraryDb,
} from '../storage/library-db';
import { folderNameMessage } from '../storage/folder-names';

function NewFolderForm({
  db,
  onClose,
  onCreated,
}: {
  db: LibraryDb;
  onClose: () => void;
  onCreated: (folder: FolderRecord) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const inputId = useId();

  // The invalid field is re-rendered with its alert icon; keep the caret in it.
  useEffect(() => {
    if (error !== null) input.current?.focus();
  }, [error]);

  const submit = async () => {
    try {
      const folder = await createFolder(db, name);
      onClose();
      onCreated(folder);
    } catch (caught) {
      if (!(caught instanceof FolderNameError)) throw caught;
      setError(folderNameMessage(caught.code, name));
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>New folder</DialogTitle>
        <DialogDescription>Folders organize decks in this browser.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-body-sm font-medium text-ink-secondary">
          Folder name
        </label>
        <Input
          ref={input}
          id={inputId}
          value={name}
          autoComplete="off"
          invalid={error !== null}
          aria-describedby={error === null ? undefined : errorId}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        {error !== null && (
          <p id={errorId} className="text-body-sm text-clay-ink">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Create
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * New folder (FR-019, design 72–73): empty and duplicate names (ignoring case and surrounding
 * spaces) show an inline error under the field, and focus stays in the field. The form mounts
 * with the dialog, so every opening starts empty.
 */
export function NewFolderDialog({
  db,
  open,
  onOpenChange,
  onCreated,
}: {
  db: LibraryDb;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (folder: FolderRecord) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <NewFolderForm
          db={db}
          onClose={() => {
            onOpenChange(false);
          }}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
