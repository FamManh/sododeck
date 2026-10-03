/**
 * "Add field" (032 US1, frame 124): name, kind menu ("Field type", frame order), options for
 * select / status (status starts with To do / In progress / Done), "Show on card". ⏎ adds the
 * field to the card's type as one undo step; Esc cancels.
 */
import { STATUS_OPTIONS, typeName, type NewFieldOption, type TypeId } from '@sododeck/model';
import type { FieldKind } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Input } from '@sododeck/ui/components/input';
import { Switch } from '@sododeck/ui/components/switch';
import { TagChip } from '@sododeck/ui/components/tag-chip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ChevronDown, Plus } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldError } from '../field-edit';
import { tagColours } from '../tags/tag-colours';
import { KIND_ICONS, KIND_MENU, KIND_NAMES } from './field-icons';
import { tryFieldEdit } from './field-writes';

const statusStart = (): NewFieldOption[] => STATUS_OPTIONS.map(({ id: _id, ...option }) => option);

export function AddFieldForm({ typeId }: { typeId: TypeId }) {
  const editor = useEditor();
  const announce = useUiStore((s) => s.announce);
  const errorId = useId();
  const switchId = useId();
  const menuLabelId = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FieldKind>('text');
  const [options, setOptions] = useState<NewFieldOption[]>([]);
  const [option, setOption] = useState('');
  const [onCard, setOnCard] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const choice = kind === 'select' || kind === 'status';

  const reset = () => {
    setName('');
    setKind('text');
    setOptions([]);
    setOption('');
    setOnCard(true);
    setError(null);
  };
  const cancel = () => {
    reset();
    setOpen(false);
    requestAnimationFrame(() => addButton.current?.focus());
  };
  const pickKind = (next: FieldKind) => {
    setKind(next);
    if (next === 'status' && kind !== 'status' && options.length === 0) setOptions(statusStart());
    if (next !== 'select' && next !== 'status') setOptions([]);
  };
  const addOption = () => {
    const label = option.trim();
    if (label === '') return;
    if (options.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      setError(`There is already an option "${label}".`);
      return;
    }
    setOptions([...options, { label }]);
    setOption('');
    setError(null);
  };
  const submit = () => {
    const trimmed = name.trim();
    const message = tryFieldEdit(editor, () => {
      editor.addField({
        name: trimmed,
        kind,
        types: [typeId],
        ...(onCard ? { onCard: true } : {}),
        ...(choice ? { options } : {}),
      });
    });
    setError(message);
    if (message !== null) return;
    announce(`${trimmed} added`);
    cancel();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  };

  if (!open) {
    return (
      <button
        ref={addButton}
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className={cn(
          'inline-flex h-8 cursor-pointer items-center gap-2 self-start rounded-button border border-dashed border-border px-3 text-body-sm text-ink-secondary hover:bg-surface-2',
          focusRing,
        )}
      >
        <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
        Add field
      </button>
    );
  }

  const KindIcon = KIND_ICONS[kind];
  return (
    <div
      role="group"
      aria-label={`New field for ${typeName(typeId)}`}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-2 border-t border-border pt-3"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input
          aria-label="Field name"
          autoFocus
          placeholder="Field name"
          value={name}
          aria-invalid={error !== null || undefined}
          aria-describedby={error === null ? undefined : errorId}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          className="h-9"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="h-9"
              aria-label={`Kind: ${KIND_NAMES[kind]}`}
            >
              <KindIcon aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
              {KIND_NAMES[kind]}
              <ChevronDown aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" aria-labelledby={menuLabelId}>
            <DropdownMenuLabel id={menuLabelId}>Field type</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={kind}
              onValueChange={(value) => {
                pickKind(value as FieldKind);
              }}
            >
              {KIND_MENU.map((item) => {
                const Icon = KIND_ICONS[item];
                return (
                  <DropdownMenuRadioItem key={item} value={item}>
                    <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
                    {KIND_NAMES[item]}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {choice && (
        <div className="flex flex-wrap items-center gap-1.5">
          <ul aria-label="New field options" className="contents">
            {options.map((o) => {
              const colours = tagColours(o.color);
              return (
                <li key={o.label}>
                  <TagChip
                    size="deck"
                    label={o.label}
                    colour={{ chip: colours.chip, ink: colours.ink }}
                    onRemove={() => {
                      setOptions(options.filter((other) => other !== o));
                    }}
                    removeLabel={`Remove ${o.label}`}
                  />
                </li>
              );
            })}
          </ul>
          <Input
            aria-label="New option"
            placeholder="+ Option"
            value={option}
            onChange={(event) => {
              setOption(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                addOption();
              }
            }}
            className="h-7 w-28"
          />
        </div>
      )}
      {error !== null && <FieldError id={errorId}>{error}</FieldError>}
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={switchId} className="flex items-center gap-2 text-body-sm text-ink">
          <Switch id={switchId} checked={onCard} onCheckedChange={setOnCard} />
          Show on card
        </label>
        <span className="text-caption text-ink-muted">Esc cancels · ⏎ adds</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={submit}>
          Add field
        </Button>
        <Button size="sm" variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
