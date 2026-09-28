import { Button } from '@sododeck/ui/components/button';
import { InlineEdit } from '@sododeck/ui/components/inline-edit';
import { cn } from '@sododeck/ui/lib/utils';
import { useState } from 'react';

import { useEditor } from '../model/use-editor';

/**
 * The deck name: a button "Rename deck" that turns into a field (003 FR-017), in the rule
 * editor's breadcrumb and the canvas deck island (018).
 * Enter saves through the editor (one undo step), Esc cancels, an empty name keeps the old one.
 */
export function DeckName({ name, className }: { name: string; className?: string }) {
  const editor = useEditor();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <InlineEdit
        label="Deck name"
        value={name}
        autoFocus
        className="w-56 text-ink"
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        onCommit={(next) => {
          const trimmed = next.trim();
          if (trimmed !== '' && trimmed !== name) editor.updateMeta({ name: trimmed });
        }}
        onKeyDown={(event) => {
          // InlineEdit commits on Enter itself; leaving edit mode is ours.
          if (event.key === 'Enter') setEditing(false);
        }}
        onBlur={() => {
          setEditing(false);
        }}
      />
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Rename deck"
      title={name}
      className={cn('max-w-72 min-w-0 px-1.5 font-normal text-ink', className)}
      onClick={() => {
        setEditing(true);
      }}
    >
      <span className="truncate">{name}</span>
    </Button>
  );
}
