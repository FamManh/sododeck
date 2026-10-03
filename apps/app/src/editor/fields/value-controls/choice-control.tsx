import type { FieldOption } from '@sododeck/schema';
import { Combobox, type ComboboxOption } from '@sododeck/ui/components/combobox';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

import { tagColours } from '../../tags/tag-colours';
import { STATUS_ICONS } from '../field-icons';
import type { ValueControlProps } from './types';

/** Value of the "None" entry that clears the field. Never an option id (ids have no spaces). */
const NONE = ' none';

/** The option's mark in lists: its status icon (status) or colour dot (select). */
export function OptionMark({ option, status }: { option: FieldOption; status: boolean }) {
  const colours = tagColours(option.color);
  if (status) {
    const Icon = STATUS_ICONS[option.icon ?? 'circle'];
    return (
      <Icon
        aria-hidden
        strokeWidth={ICON_STROKE_WIDTH}
        className="size-3.5"
        style={{ color: colours.dot }}
      />
    );
  }
  return <span aria-hidden className="size-2.5 rounded-full" style={{ background: colours.dot }} />;
}

/**
 * Select and status: a pick `combobox` over the field's options (typing filters, so a long list
 * stays usable), each with its colour dot or status icon; the chosen option shows as a chip.
 */
export function ChoiceControl({
  field,
  labelId,
  value,
  mixed = false,
  onCommit,
  descriptionId,
}: ValueControlProps) {
  const status = field.kind === 'status';
  const options = field.options ?? [];
  const chosen = options.find((option) => option.id === value);
  const list: ComboboxOption[] = options.map((option) => ({
    value: option.id,
    label: option.label,
    leading: <OptionMark option={option} status={status} />,
  }));
  if (chosen !== undefined) list.push({ value: NONE, label: 'None' });
  const colours = chosen === undefined ? undefined : tagColours(chosen.color);
  return (
    <Combobox
      mode="pick"
      aria-labelledby={labelId}
      listLabel={`${field.name} options`}
      aria-describedby={descriptionId}
      maxOptions={100}
      value={chosen?.id ?? ''}
      options={list}
      placeholder={mixed ? 'Mixed' : options.length === 0 ? 'No options yet' : 'Choose…'}
      onValueChange={(next) => {
        onCommit(next === NONE ? null : next);
      }}
      className={cn('h-8', chosen !== undefined && 'rounded-full border-transparent font-medium')}
      style={colours === undefined ? undefined : { background: colours.chip, color: colours.ink }}
    />
  );
}
