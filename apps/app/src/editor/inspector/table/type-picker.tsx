import { DIALECT_TYPES, typeEntry, type TypeKind } from '@sododeck/model';
import type { DbColumn, Dialect, Id, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Combobox, type ComboboxOption } from '@sododeck/ui/components/combobox';
import { useId, useMemo, useState } from 'react';

import { createEnum } from '../../../db/enum-edits';
import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { FieldLabel } from '../../fields/field-label';
import { oneStep } from '../../fields/one-step';

const DIALECT_NAMES: Readonly<Record<Dialect, string>> = {
  generic: 'Generic',
  postgres: 'Postgres',
  mysql: 'MySQL',
  sqlite: 'SQLite',
};

const KIND_HEADINGS: Readonly<Record<TypeKind, string>> = {
  number: 'Numbers',
  text: 'Text',
  datetime: 'Date and time',
  boolean: 'Boolean',
  id: 'Identifiers',
  json: 'JSON',
  binary: 'Binary',
  other: 'Other',
};

const KIND_ORDER: readonly TypeKind[] = [
  'number',
  'text',
  'datetime',
  'boolean',
  'id',
  'json',
  'binary',
  'other',
];

const ENUM_GROUP = 'Enums in this deck';
const ENUM_PREFIX = 'enum:';

/** Enums first, then the dialect's types grouped by kind (frame 164). */
function typeOptions(deck: SododeckFile, dialect: Dialect): ComboboxOption[] {
  const enums = (deck.enums ?? []).map((e) => ({
    value: `${ENUM_PREFIX}${e.id}`,
    label: e.name,
    group: ENUM_GROUP,
  }));
  const entries = DIALECT_TYPES[dialect];
  const types = KIND_ORDER.flatMap((kind) =>
    entries
      .filter((t) => t.kind === kind)
      .map((t) => ({ value: t.name, label: t.name, group: KIND_HEADINGS[kind] })),
  );
  return [...enums, ...types];
}

/**
 * The column type field of the Columns tab (052 R5, R11): a free-text combobox listing the deck's
 * enums and the dialect's types. A type outside the list is accepted and only marked. Typing
 * commits on Enter or blur; picking an option writes at once. Choosing an enum links the column
 * (`enumRef` and the enum's name as `type`); choosing a type clears the link.
 */
export function TypePicker({
  deck,
  tableId,
  column,
  disabled = false,
}: {
  deck: SododeckFile;
  tableId: Id;
  column: DbColumn;
  disabled?: boolean;
}) {
  const editor = useEditor();
  const id = useId();
  const dialect = deck.dialect ?? 'generic';
  const options = useMemo(() => typeOptions(deck, dialect), [deck, dialect]);
  const [draft, setDraft] = useState<string | null>(null);
  const typeText = column.type.trim();
  const linked = deck.enums?.find((e) => e.id === column.enumRef);
  const outside =
    linked === undefined && typeText !== '' && typeEntry(dialect, typeText) === undefined;

  const commit = () => {
    const text = (draft ?? typeText).trim();
    setDraft(null);
    if (text === '' || text === typeText) return;
    oneStep(editor, () => {
      editor.updateColumn(tableId, column.id, {
        type: text,
        ...(column.enumRef !== undefined && linked?.name !== text ? { enumRef: null } : {}),
      });
    });
  };

  const choose = (value: string) => {
    setDraft(null);
    oneStep(editor, () => {
      if (value.startsWith(ENUM_PREFIX)) {
        const item = deck.enums?.find((e) => `${ENUM_PREFIX}${e.id}` === value);
        if (item !== undefined) {
          editor.updateColumn(tableId, column.id, { enumRef: item.id, type: item.name });
        }
      } else {
        editor.updateColumn(tableId, column.id, { type: value, enumRef: null });
      }
    });
  };

  const openEnum = (enumId: Id) => {
    useUiStore.getState().openEnumDrawer(enumId, { selectName: true });
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel htmlFor={id}>Type</FieldLabel>
      <Combobox
        id={id}
        mode="free"
        label="Type"
        listLabel="Type suggestions"
        value={draft ?? typeText}
        options={options}
        maxOptions={options.length}
        disabled={disabled}
        className="font-mono"
        onValueChange={setDraft}
        onOptionSelect={choose}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape' && draft !== null) {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
          }
        }}
      />
      {outside && (
        <span className="text-caption text-ink-muted">{`Not in the ${DIALECT_NAMES[dialect]} list`}</span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {linked === undefined ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              const enumId = oneStepCreate();
              openEnum(enumId);
            }}
          >
            New enum…
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                openEnum(linked.id);
              }}
            >
              Edit enum
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                oneStep(editor, () => {
                  editor.updateColumn(tableId, column.id, { enumRef: null });
                });
              }}
            >
              No enum
            </Button>
          </>
        )}
      </div>
    </div>
  );

  function oneStepCreate(): Id {
    let created = '';
    oneStep(editor, () => {
      created = createEnum(editor, deck, { linkColumn: { tableId, columnId: column.id } });
    });
    return created;
  }
}
