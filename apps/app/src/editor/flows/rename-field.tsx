import { InlineEdit } from '@sododeck/ui/components/inline-edit';

/**
 * Inline rename of a feature or flow (FR-002, FR-003): Enter or blur saves, Esc cancels, and an
 * empty name keeps the old one.
 */
export function RenameField({
  label,
  value,
  onCommit,
  onDone,
}: {
  label: string;
  value: string;
  onCommit: (title: string) => void;
  onDone: () => void;
}) {
  return (
    <InlineEdit
      label={label}
      value={value}
      autoFocus
      className="h-7 min-w-0 flex-1 text-body text-ink"
      onFocus={(event) => {
        event.currentTarget.select();
      }}
      onCommit={(next) => {
        const trimmed = next.trim();
        if (trimmed !== '' && trimmed !== value) onCommit(trimmed);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter' || event.key === 'Escape') onDone();
      }}
      onBlur={onDone}
    />
  );
}
