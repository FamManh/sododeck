import { isDateString } from '@sododeck/model';
import { Input } from '@sododeck/ui/components/input';

import type { ValueControlProps } from './types';

/** Date: a date input; clearing it clears the value. Stored as `YYYY-MM-DD`, no time zone. */
export function DateControl({ labelId, value, onCommit, descriptionId }: ValueControlProps) {
  return (
    <Input
      type="date"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      value={isDateString(value) ? value : ''}
      onChange={(event) => {
        const next = event.target.value;
        if (next === '') onCommit(null);
        else if (isDateString(next)) onCommit(next);
      }}
      className="h-8 font-mono"
    />
  );
}
