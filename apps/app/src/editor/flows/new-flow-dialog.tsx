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
import { Circle } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { startNewFlow } from './flow-session';

export interface NewFlowTarget {
  featureId: string | null;
  /** Shown in the title: "New flow in Delivery" (or "No feature"). */
  featureName: string;
}

function NewFlowForm({ target, onClose }: { target: NewFlowTarget; onClose: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  // The invalid field re-renders with its alert icon; keep the caret in it.
  useEffect(() => {
    if (error) input.current?.focus();
  }, [error]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === '') {
          setError(true);
          return;
        }
        onClose();
        startNewFlow(name, target.featureId);
      }}
    >
      <DialogHeader>
        <DialogTitle>New flow in {target.featureName}</DialogTitle>
        <DialogDescription>
          Name it, then click connections on the canvas in order. Each click adds a step.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-body-sm font-medium text-ink-secondary">
          Name
        </label>
        <Input
          ref={input}
          id={inputId}
          value={name}
          autoComplete="off"
          placeholder="e.g. Place order"
          invalid={error}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setError(false);
          }}
        />
        {error && (
          <p id={errorId} className="text-body-sm text-clay-ink">
            Enter a flow name
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          <Circle className="fill-current" />
          Start recording
        </Button>
      </DialogFooter>
    </form>
  );
}

/** "+ New flow" (FR-006): asks for a required name, then starts recording. */
export function NewFlowDialog({
  target,
  onClose,
}: {
  target: NewFlowTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        {target !== null && <NewFlowForm target={target} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
