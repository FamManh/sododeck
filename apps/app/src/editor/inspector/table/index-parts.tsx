import type { DbIndexPart, Id } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Input } from '@sododeck/ui/components/input';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { useUiStore } from '../../../state/ui-store';
import { partLabel } from './part-label';

interface Column {
  id: Id;
  name: string;
}

/**
 * The parts of one index (052): column chips and `{ expr }` chips in order. A chip is a group
 * that ⌥← / ⌥→ moves; the last part cannot be removed because an index needs at least one.
 * "+ Column" lists the table's columns, "+ Expression" opens a field that adds on Enter.
 */
export function IndexParts({
  parts,
  columns,
  onChange,
}: {
  parts: readonly DbIndexPart[];
  columns: readonly Column[];
  /** Writes the whole new list (one `updateIndex`). */
  onChange: (parts: DbIndexPart[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const announce = useUiStore((s) => s.announce);

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    const part = parts[index];
    if (part === undefined || target < 0 || target >= parts.length) return;
    const next = [...parts];
    next.splice(index, 1);
    next.splice(target, 0, part);
    onChange(next);
    announce(
      `${partLabel(part, columns)} moved to position ${String(target + 1)} of ${String(parts.length)}`,
    );
  };
  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLElement>) => {
    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    move(index, event.key === 'ArrowLeft' ? -1 : 1);
  };
  const commitExpression = () => {
    const expr = draft.trim();
    if (expr !== '') onChange([...parts, { expr }]);
    setDraft('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {parts.map((part, index) => {
        const label = partLabel(part, columns);
        return (
          <span
            // A part has no id and an expression can repeat, so the position is part of the key.
            key={`${String(index)}:${label}`}
            role="group"
            aria-label={label}
            tabIndex={0}
            onKeyDown={onKeyDown(index)}
            className={cn(
              'inline-flex items-center gap-1 rounded-pill bg-surface-2 py-0.5 pr-1 pl-2.5 text-body-sm text-ink',
              typeof part !== 'string' && 'font-mono',
              focusRing,
            )}
          >
            {label}
            <button
              type="button"
              aria-label={`Remove ${label}`}
              disabled={parts.length === 1}
              onClick={() => {
                onChange(parts.filter((_, i) => i !== index));
                announce(`${label} removed`);
              }}
              className={cn(
                'flex size-4 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40',
                focusRing,
              )}
            >
              <X aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
            </button>
          </span>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            + Column
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {columns.map((column) => (
            <DropdownMenuItem
              key={column.id}
              onSelect={() => {
                onChange([...parts, column.id]);
              }}
            >
              {column.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {adding ? (
        <Input
          autoFocus
          aria-label="Expression"
          className="h-7 w-44 font-mono"
          placeholder="lower(email)"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={commitExpression}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitExpression();
            } else if (event.key === 'Escape') {
              event.stopPropagation();
              setDraft('');
              setAdding(false);
            }
          }}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAdding(true);
          }}
        >
          + Expression
        </Button>
      )}
    </div>
  );
}
