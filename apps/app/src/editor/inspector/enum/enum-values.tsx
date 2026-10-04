import type { DbEnum, Id, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { GripVertical, Plus } from 'lucide-react';
import { useState } from 'react';

import { renameEnumValue } from '../../../db/enum-edits';
import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { oneStep } from '../../fields/one-step';
import { useSortableList } from '../../flows/use-sortable-list';
import { LiveTextField } from '../table/live-text-field';
import { PartMenu } from '../table/part-menu';

/** `value_1`, or the first `value_n` the enum does not have (any case). */
function nextValueName(dbEnum: DbEnum): string {
  const taken = new Set(dbEnum.values.map((v) => v.name.toLowerCase()));
  let n = 1;
  while (taken.has(`value_${String(n)}`)) n += 1;
  return `value_${String(n)}`;
}

/**
 * The values of an enum (052, frame 165): one row per value with a grip, the name, a note and a
 * ⋯ menu; "+ Value" adds `value_n` with its name focused. Rows reorder by drag and ⌥↑ / ⌥↓.
 * A rename also renames matching defaults of the linked columns, in the same step.
 */
export function EnumValues({ deck, dbEnum }: { deck: SododeckFile; dbEnum: DbEnum }) {
  const editor = useEditor();
  const [focusId, setFocusId] = useState<Id | null>(null);
  const sort = useSortableList({
    ids: dbEnum.values.map((v) => v.id),
    group: `enum-values:${dbEnum.id}`,
    onMove: (id, position) => {
      oneStep(editor, () => {
        editor.moveEnumValue(dbEnum.id, id, position);
      });
    },
  });

  const add = () => {
    let id = '';
    oneStep(editor, () => {
      id = editor.addEnumValue(dbEnum.id, { name: nextValueName(dbEnum) });
    });
    setFocusId(id);
    useUiStore.getState().announce('Value added');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-body-sm text-ink-secondary">
          {dbEnum.values.length === 0 ? 'No values yet.' : `${String(dbEnum.values.length)} values`}
        </span>
        <Button variant="ghost" size="sm" aria-label="Add value" onClick={add}>
          <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
          Value
        </Button>
      </div>
      <ul aria-label="Values" className="flex flex-col gap-1">
        {dbEnum.values.map((value, index) => (
          <li
            key={value.id}
            {...sort.rowProps(value.id)}
            className={cn(
              'flex items-start gap-1 rounded-row border border-transparent',
              sort.drag?.id === value.id && 'opacity-50',
              sort.drag !== null && sort.drag.over === index && 'border-primary',
            )}
          >
            <span
              {...sort.gripProps(value.id)}
              className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-ink-muted"
            >
              <GripVertical aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
            </span>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <LiveTextField
                label={`Value name ${value.name}`}
                hideLabel
                required
                mono
                autoSelect={focusId === value.id}
                value={value.name}
                validate={(text) =>
                  dbEnum.values.some(
                    (v) => v.id !== value.id && v.name.toLowerCase() === text.toLowerCase(),
                  )
                    ? `${text} is already a value of ${dbEnum.name}`
                    : undefined
                }
                onWrite={(name) => {
                  renameEnumValue(editor, deck, dbEnum.id, value.id, name);
                }}
              />
              <LiveTextField
                label={`Value note ${value.name}`}
                hideLabel
                placeholder="Note"
                value={value.note ?? ''}
                onWrite={(note) => {
                  editor.updateEnumValue(dbEnum.id, value.id, { note: note === '' ? null : note });
                }}
              />
            </div>
            <PartMenu
              label={`Value options ${value.name}`}
              deleteLabel="Delete value"
              onDelete={() => {
                oneStep(editor, () => {
                  editor.removeEnumValue(dbEnum.id, value.id);
                });
                useUiStore.getState().announce('Value deleted');
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
