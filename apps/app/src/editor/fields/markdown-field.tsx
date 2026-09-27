import { MarkdownView } from '@sododeck/ui/components/markdown-view';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { useId } from 'react';

import { useUiStore, type DescriptionMode } from '../../state/ui-store';
import { FieldLabel } from './field-label';
import { TextareaEdit } from './textarea-edit';

/**
 * A markdown description with Write / Preview (FR-003, design 18). Write saves as the user types
 * (`TextareaEdit`); Preview renders paragraphs, bullets and inline code as React elements only.
 * The choice is UI state per field (`modeKey`, e.g. `nodes:<id>`), kept while the selection stays.
 */
export function MarkdownField({
  modeKey,
  label = 'Description',
  value,
  onCommit,
  placeholder,
}: {
  modeKey: string;
  label?: string;
  value: string;
  /** Receives the trimmed text; `''` means clear. */
  onCommit: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const mode = useUiStore((s) => s.descriptionMode[modeKey] ?? 'write');
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={mode === 'write' ? id : undefined}>{label} · Markdown</FieldLabel>
        <SegmentedControl
          aria-label={`${label} view`}
          value={mode}
          onValueChange={(next) => {
            useUiStore.getState().setDescriptionMode(modeKey, next as DescriptionMode);
          }}
          className="h-7"
        >
          <SegmentedControlItem value="write" className="px-2 text-caption">
            Write
          </SegmentedControlItem>
          <SegmentedControlItem value="preview" className="px-2 text-caption">
            Preview
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
      {mode === 'write' ? (
        <TextareaEdit
          id={id}
          hideLabel
          label={label}
          value={value}
          placeholder={placeholder}
          onCommit={onCommit}
        />
      ) : (
        <MarkdownView
          role="region"
          aria-label={`${label} preview`}
          text={value}
          className="max-h-72 min-h-16 overflow-y-auto rounded-input border border-border px-[11px] py-2"
        />
      )}
    </div>
  );
}
