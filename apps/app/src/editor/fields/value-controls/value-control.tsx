import { ChoiceControl } from './choice-control';
import { DateControl } from './date-control';
import { DateRangeControl } from './date-range-control';
import { LinkControl } from './link-control';
import { NumberControl } from './number-control';
import { PersonControl } from './person-control';
import { ProgressControl } from './progress-control';
import { TextControl } from './text-control';
import type { ValueControlProps } from './types';

/** The control that fits a field's kind (032 US1 AS3). */
export function ValueControl(props: ValueControlProps) {
  switch (props.field.kind) {
    case 'text':
      return <TextControl {...props} />;
    case 'number':
      return <NumberControl {...props} />;
    case 'select':
    case 'status':
      return <ChoiceControl {...props} />;
    case 'person':
      return <PersonControl {...props} />;
    case 'date':
      return <DateControl {...props} />;
    case 'dateRange':
      return <DateRangeControl {...props} />;
    case 'link':
      return <LinkControl {...props} />;
    case 'progress':
      return <ProgressControl {...props} />;
  }
}
