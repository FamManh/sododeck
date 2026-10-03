/**
 * "Edit options…" for a select or status field (032 US3 AS2): rename, recolour, change the status
 * icon, reorder (⌥↑ / ⌥↓ on a label) and delete options; "+ Option" adds one. Each change is one
 * undo step; deleting an option that cards use asks first and clears those values with it.
 */
import { fieldUsage, type ResolvedField } from '@sododeck/model';
import type { SododeckFile, StatusIcon } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Input } from '@sododeck/ui/components/input';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { SwatchGrid } from '@sododeck/ui/components/swatch-grid';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldError } from '../field-edit';
import { tagColours } from '../tags/tag-colours';
import { ConfirmDialog } from './confirm-dialog';
import { STATUS_ICON_LIST, STATUS_ICON_NAMES, STATUS_ICONS } from './field-icons';
import { countText, tryFieldEdit } from './field-writes';
import { NO_OPTION_COLOUR, optionColourChoices } from './option-colours';

export function FieldOptionsEditor({ deck, field }: { deck: SododeckFile; field: ResolvedField }) {
  const editor = useEditor();
  const announce = useUiStore((s) => s.announce);
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; label: string; used: number } | null>(
    null,
  );
  const options = field.options ?? [];
  const status = field.kind === 'status';
  const run = (write: () => void) => {
    const message = tryFieldEdit(editor, write);
    setError(message);
    return message === null;
  };

  const rename = (id: string, current: string) => {
    const draft = drafts[id];
    if (draft === undefined || draft.trim() === current) {
      setDrafts(({ [id]: _, ...rest }) => rest);
      return;
    }
    if (
      run(() => {
        editor.updateOption(field.id, id, { label: draft });
      })
    ) {
      setDrafts(({ [id]: _, ...rest }) => rest);
    }
  };

  const add = () => {
    if (adding.trim() === '') return;
    if (run(() => editor.addOption(field.id, { label: adding }))) {
      announce(`${adding.trim()} added`);
      setAdding('');
    }
  };

  const remove = (id: string, label: string) => {
    if (
      run(() => {
        editor.deleteOption(field.id, id);
      })
    ) {
      announce(`${label} deleted`);
    }
    setDeleting(null);
  };

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border p-2">
      <ul aria-label={`${field.name} options`} className="flex flex-col gap-1">
        {options.map((option, index) => {
          const colours = tagColours(option.color);
          const Icon = STATUS_ICONS[option.icon ?? 'circle'];
          return (
            <li key={option.id} className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Colour of ${option.label}`}
                    className={cn(
                      'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-row hover:bg-surface-2',
                      focusRing,
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-3 rounded-full"
                      style={{ background: colours.dot }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent aria-label={`Colour of ${option.label}`} className="w-64 p-3">
                  <SwatchGrid
                    label="Option colour"
                    options={optionColourChoices(deck)}
                    value={option.color ?? NO_OPTION_COLOUR}
                    onSelect={(value) => {
                      const color = value === NO_OPTION_COLOUR ? null : value;
                      run(() => {
                        editor.updateOption(field.id, option.id, { color });
                      });
                    }}
                  />
                </PopoverContent>
              </Popover>
              {status && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Icon of ${option.label}`}
                      className={cn(
                        'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-row hover:bg-surface-2',
                        focusRing,
                      )}
                    >
                      <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent aria-label="Status icon">
                    <DropdownMenuRadioGroup
                      value={option.icon ?? 'circle'}
                      onValueChange={(value) => {
                        run(() => {
                          editor.updateOption(field.id, option.id, { icon: value as StatusIcon });
                        });
                      }}
                    >
                      {STATUS_ICON_LIST.map((icon) => {
                        const Mark = STATUS_ICONS[icon];
                        return (
                          <DropdownMenuRadioItem key={icon} value={icon}>
                            <Mark aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
                            {STATUS_ICON_NAMES[icon]}
                          </DropdownMenuRadioItem>
                        );
                      })}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Input
                aria-label={`Option ${option.label}`}
                aria-describedby={error === null ? undefined : errorId}
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                value={drafts[option.id] ?? option.label}
                onChange={(event) => {
                  setDrafts((d) => ({ ...d, [option.id]: event.target.value }));
                }}
                onBlur={() => {
                  rename(option.id, option.label);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    rename(option.id, option.label);
                  } else if (
                    event.altKey &&
                    (event.key === 'ArrowUp' || event.key === 'ArrowDown')
                  ) {
                    event.preventDefault();
                    const up = event.key === 'ArrowUp';
                    const before = up ? options[index - 1]?.id : (options[index + 2]?.id ?? null);
                    if (before === undefined || (!up && index === options.length - 1)) return;
                    run(() => {
                      editor.moveOption(field.id, option.id, before);
                    });
                  }
                }}
                className="h-8 min-w-0 flex-1"
              />
              <button
                type="button"
                aria-label={`Delete ${option.label}`}
                onClick={() => {
                  const used = fieldUsage(deck, field.id, option.id);
                  if (used === 0) remove(option.id, option.label);
                  else setDeleting({ id: option.id, label: option.label, used });
                }}
                className={cn(
                  'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-row text-ink-secondary hover:bg-surface-2 hover:text-clay-ink',
                  focusRing,
                )}
              >
                <Trash2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-1.5">
        <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 text-ink-secondary" />
        <Input
          aria-label="New option"
          placeholder="Option"
          value={adding}
          onChange={(event) => {
            setAdding(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          className="h-8 min-w-0 flex-1"
        />
        <Button size="sm" variant="ghost" onClick={add}>
          Add
        </Button>
      </div>
      {error !== null && <FieldError id={errorId}>{error}</FieldError>}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete option · used on ${countText(deleting?.used ?? 0, 'card')}`}
        body={`“${deleting?.label ?? ''}” is removed from ${field.name}, and its value is cleared on those cards. ⌘Z undoes it.`}
        confirmLabel="Delete option"
        onCancel={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting !== null) remove(deleting.id, deleting.label);
        }}
      />
    </div>
  );
}
