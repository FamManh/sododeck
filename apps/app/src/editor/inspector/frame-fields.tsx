import type { Id } from '@sododeck/schema';
import { Input } from '@sododeck/ui/components/input';
import { PanelSection } from '@sododeck/ui/components/panel';
import { useId, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { groupBounds } from '../canvas-geometry';
import { frameRect } from '../editing/frame-resize';
import { oneStep } from '../fields/one-step';
import type { ViewState } from '../views/view-state';

const FIELDS = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
] as const;

/**
 * The group's frame as numbers (016 FR-044): the keyboard path to moving and resizing a frame.
 * Each commit (Enter or leaving the field) is one undo step, clamped like a handle drag (members
 * plus padding, at least 160 × 96). Only the frame changes: members stay where they are.
 */
export function FrameFields({ view, groupId }: { view: ViewState; groupId: Id }) {
  const editor = useEditor();
  const id = useId();
  const editable = useUiStore((s) => !isFlowMode(s) && s.flowSession === null);
  const rect = groupBounds(view.deck, 'component').get(groupId);
  if (rect === undefined) return null;
  return (
    <PanelSection label="Frame">
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(({ key, label }) => (
          <FrameField
            key={key}
            id={`${id}-${key}`}
            label={label}
            value={Math.round(rect[key])}
            disabled={!editable}
            onCommit={(value) => {
              const frame = frameRect(view.deck, groupId, { ...rect, [key]: value });
              oneStep(editor, () => {
                editor.setGroupFrames(view.view.id, { [groupId]: frame });
              });
            }}
          />
        ))}
      </div>
    </PanelSection>
  );
}

function FrameField({
  id,
  label,
  value,
  disabled,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  // The draft is the only copy while typing; the document changes on commit.
  const [draft, setDraft] = useState<string | null>(null);
  const done = () => {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (draft.trim() !== '' && Number.isFinite(next) && Math.round(next) !== value) {
      onCommit(Math.round(next));
    }
  };
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-caption text-ink-secondary">
      {label}
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={done}
        onKeyDown={(event) => {
          if (event.key === 'Enter') done();
          if (event.key === 'Escape' && draft !== null) {
            event.stopPropagation();
            setDraft(null);
          }
        }}
      />
    </label>
  );
}
