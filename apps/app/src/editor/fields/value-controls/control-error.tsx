import { FieldError } from '../../field-edit';

/** The message under a value control when an entry is refused (FR-015). */
export function ControlError({ id, message }: { id: string; message: string | null }) {
  return message === null ? null : <FieldError id={id}>{message}</FieldError>;
}
