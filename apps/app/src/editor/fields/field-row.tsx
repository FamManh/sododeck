/**
 * One row of the drawer's Fields list (032, frame 124, contracts/fields-ui.md): drag handle
 * (⌥↑ / ⌥↓ move it), kind icon, name, value control, the row menu and the "On card" switch.
 * Built-ins show only the handle and the switch (FR-004).
 */
import { clearedByKindChange, fieldUsage, type ResolvedField } from '@sododeck/model';
import type { FieldKind, SododeckFile } from '@sododeck/schema';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Input } from '@sododeck/ui/components/input';
import { Switch } from '@sododeck/ui/components/switch';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { GripVertical, MoreHorizontal } from 'lucide-react';
import { useId, useState, type DragEvent, type KeyboardEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldError } from '../field-edit';
import { appliesText } from './applies-text';
import { ConfirmDialog } from './confirm-dialog';
import { KIND_ICONS, KIND_MENU, KIND_NAMES } from './field-icons';
import { FieldOptionsEditor } from './field-options-editor';
import { FieldTypesPicker } from './field-types-picker';
import { countText, tryFieldEdit } from './field-writes';
import { ValueControl } from './value-controls/value-control';

export interface FieldRowProps {
  deck: SododeckFile;
  field: ResolvedField;
  value: unknown;
  mixed: boolean;
  /** Bulk only: "Mixed values" or "Same on all 3", read with the control. */
  bulkHint?: string;
  people: readonly string[];
  onCommit: (value: unknown) => void;
  /** Reorder and definition edits need one card type (single-type selections). */
  editable: boolean;
  /** Moves the row up or down one place in its type's list. */
  onMove: (direction: -1 | 1) => void;
  /** Pointer drag between rows (HTML drag and drop). */
  drag: {
    onStart: (id: string) => void;
    onOver: (id: string, event: DragEvent) => void;
    onDrop: (id: string, event: DragEvent) => void;
    onEnd: () => void;
    over: boolean;
  };
}

type Panel = 'rename' | 'options' | 'types' | null;

export function FieldRow({
  deck,
  field,
  value,
  mixed,
  bulkHint,
  people,
  onCommit,
  editable,
  onMove,
  drag,
}: FieldRowProps) {
  const editor = useEditor();
  const announce = useUiStore((s) => s.announce);
  const labelId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const hintId = useId();
  const [panel, setPanel] = useState<Panel>(null);
  const [rename, setRename] = useState(field.name);
  const [error, setError] = useState<string | null>(null);
  const [kindChange, setKindChange] = useState<{ kind: FieldKind; cleared: number } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [draggable, setDraggable] = useState(false);
  const builtIn = field.source === 'built-in';
  const Icon = KIND_ICONS[field.kind];
  const choice = field.kind === 'select' || field.kind === 'status';

  const run = (write: () => void) => {
    const message = tryFieldEdit(editor, write);
    setError(message);
    return message === null;
  };

  const commitRename = () => {
    if (rename.trim() === field.name) {
      setPanel(null);
      return;
    }
    if (
      run(() => {
        editor.updateField(field.id, { name: rename });
      })
    ) {
      announce(`${field.name} renamed to ${rename.trim()}`);
      setPanel(null);
    }
  };

  const changeKind = (kind: FieldKind) => {
    if (
      run(() => {
        editor.changeFieldKind(field.id, kind);
      })
    ) {
      announce(`${field.name} is now ${KIND_NAMES[kind]}`);
    }
    setKindChange(null);
  };

  const deleteField = () => {
    if (
      run(() => {
        editor.deleteField(field.id);
      })
    ) {
      announce(`${field.name} deleted`);
    }
    setDeleting(null);
  };

  const onHandleKey = (event: KeyboardEvent) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    onMove(event.key === 'ArrowUp' ? -1 : 1);
  };

  return (
    <li
      draggable={editable && draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        drag.onStart(field.id);
      }}
      onDragOver={(event) => {
        drag.onOver(field.id, event);
      }}
      onDrop={(event) => {
        drag.onDrop(field.id, event);
      }}
      onDragEnd={() => {
        setDraggable(false);
        drag.onEnd();
      }}
      className={cn(
        'flex flex-col gap-1 rounded-row py-1',
        drag.over && 'shadow-[inset_0_2px_0_var(--color-primary)]',
      )}
    >
      <div className="grid grid-cols-[1rem_1rem_minmax(0,5rem)_minmax(0,1fr)_auto_auto] items-center gap-1.5">
        {editable ? (
          <button
            type="button"
            aria-label={`Reorder ${field.name}`}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            onKeyDown={onHandleKey}
            onPointerDown={() => {
              setDraggable(true);
            }}
            onPointerUp={() => {
              setDraggable(false);
            }}
            className={cn(
              'inline-flex h-7 w-4 cursor-grab items-center justify-center rounded-row text-ink-muted hover:bg-surface-2',
              focusRing,
            )}
          >
            <GripVertical aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
          </button>
        ) : (
          <span />
        )}
        <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 text-ink-secondary" />
        {panel === 'rename' ? (
          <Input
            aria-label="Field name"
            autoFocus
            value={rename}
            aria-invalid={error !== null || undefined}
            aria-describedby={error === null ? undefined : errorId}
            onChange={(event) => {
              setRename(event.target.value);
              setError(null);
            }}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitRename();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setRename(field.name);
                setError(null);
                setPanel(null);
              }
            }}
            className="h-8"
          />
        ) : (
          <span id={labelId} title={field.name} className="truncate text-body text-ink">
            {field.name}
          </span>
        )}
        <ValueControl
          field={field}
          labelId={labelId}
          value={value}
          mixed={mixed}
          descriptionId={bulkHint === undefined ? undefined : hintId}
          onCommit={onCommit}
          people={people}
        />
        {editable && !builtIn ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${field.name} options`}
                className={cn(
                  'inline-flex size-6 cursor-pointer items-center justify-center rounded-row text-ink-secondary hover:bg-surface-2',
                  focusRing,
                )}
              >
                <MoreHorizontal aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" aria-label={`${field.name} options`}>
              <DropdownMenuItem
                onSelect={() => {
                  setRename(field.name);
                  setPanel('rename');
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change kind…</DropdownMenuSubTrigger>
                <DropdownMenuSubContent aria-label="Field type" aria-labelledby={undefined}>
                  {KIND_MENU.filter((kind) => kind !== field.kind).map((kind) => {
                    const KindIcon = KIND_ICONS[kind];
                    return (
                      <DropdownMenuItem
                        key={kind}
                        onSelect={() => {
                          const cleared = clearedByKindChange(deck, field.id, kind);
                          if (cleared === 0) changeKind(kind);
                          else setKindChange({ kind, cleared });
                        }}
                      >
                        <KindIcon aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
                        {KIND_NAMES[kind]}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {choice && (
                <DropdownMenuItem
                  onSelect={() => {
                    setPanel('options');
                  }}
                >
                  Edit options…
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => {
                  setPanel('types');
                }}
              >
                Also use for…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-clay-ink"
                onSelect={() => {
                  setDeleting(fieldUsage(deck, field.id));
                }}
              >
                Delete field
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="w-6" />
        )}
        {editable ? (
          <>
            <Switch
              aria-label={`${field.name} on card`}
              aria-describedby={descriptionId}
              checked={field.onCard === true}
              onCheckedChange={(onCard) => {
                run(() => {
                  editor.updateField(field.id, { onCard });
                });
              }}
            />
            <span id={descriptionId} className="sr-only">
              {appliesText(field)}
            </span>
          </>
        ) : (
          <span />
        )}
      </div>
      {bulkHint !== undefined && (
        <span id={hintId} className="sr-only">
          {bulkHint}
        </span>
      )}
      {error !== null && panel !== 'options' && panel !== 'types' && (
        <FieldError id={errorId}>{error}</FieldError>
      )}
      {panel === 'options' && (
        <div className="pl-7">
          <FieldOptionsEditor deck={deck} field={field} />
          <button
            type="button"
            onClick={() => {
              setPanel(null);
            }}
            className={cn('mt-1 cursor-pointer text-body-sm text-ink-secondary', focusRing)}
          >
            Done
          </button>
        </div>
      )}
      {panel === 'types' && (
        <div className="pl-7">
          <FieldTypesPicker deck={deck} field={field} />
          <button
            type="button"
            onClick={() => {
              setPanel(null);
            }}
            className={cn('mt-1 cursor-pointer text-body-sm text-ink-secondary', focusRing)}
          >
            Done
          </button>
        </div>
      )}
      <ConfirmDialog
        open={kindChange !== null}
        title={`Change kind to ${kindChange === null ? '' : KIND_NAMES[kindChange.kind]}? ${countText(kindChange?.cleared ?? 0, 'value')} will be cleared.`}
        body={`Values that fit the new kind are kept; the others are cleared. ⌘Z restores ${field.name} with every value.`}
        confirmLabel="Change kind"
        onCancel={() => {
          setKindChange(null);
        }}
        onConfirm={() => {
          if (kindChange !== null) changeKind(kindChange.kind);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete field · used on ${countText(deleting ?? 0, 'card')}`}
        body={`${field.name} and its values are removed from every card. ⌘Z undoes it.`}
        confirmLabel="Delete field"
        onCancel={() => {
          setDeleting(null);
        }}
        onConfirm={deleteField}
      />
    </li>
  );
}
