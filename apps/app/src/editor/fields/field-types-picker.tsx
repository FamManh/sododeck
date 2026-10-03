/**
 * "Also use for…" (032 US3 AS7): the card types a field applies to, as checkboxes. Removing a type
 * keeps that type's values (reported as unused); the last type cannot be removed.
 */
import { deckPacks, typeName, typesOfPacks, type ResolvedField } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { Checkbox } from '@sododeck/ui/components/checkbox';
import { useId, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { FieldError } from '../field-edit';
import { tryFieldEdit } from './field-writes';

export function FieldTypesPicker({ deck, field }: { deck: SododeckFile; field: ResolvedField }) {
  const editor = useEditor();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const current = field.types ?? [];
  const listed = typesOfPacks(deckPacks(deck)).map((type) => type.id);
  const ids = [...listed, ...current.filter((id) => !listed.includes(id))];
  const toggle = (id: string, on: boolean) => {
    const types = on ? [...current, id] : current.filter((type) => type !== id);
    setError(
      tryFieldEdit(editor, () => {
        editor.updateField(field.id, { types });
      }),
    );
  };
  return (
    <fieldset className="flex flex-col gap-1 rounded-card border border-border p-2">
      <legend className="px-1 text-micro text-ink-muted uppercase">Use {field.name} for</legend>
      <div className="grid grid-cols-2 gap-1">
        {ids.map((id) => {
          const checked = current.includes(id);
          return (
            <Checkbox
              key={id}
              label={typeName(id)}
              checked={checked}
              disabled={checked && current.length === 1}
              onCheckedChange={(next) => {
                toggle(id, next === true);
              }}
            />
          );
        })}
      </div>
      {error !== null && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  );
}
