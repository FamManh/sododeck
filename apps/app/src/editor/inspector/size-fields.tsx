import type { Node } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Input } from '@sododeck/ui/components/input';
import { PanelSection } from '@sododeck/ui/components/panel';
import { useId, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { cardSize, sizeLimitsOf } from '../canvas-geometry';
import { oneStep } from '../fields/one-step';

const FIELDS = [
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * The card's size as numbers (017 R4, FR-006): the keyboard path to resizing a card. Each commit
 * (Enter or leaving the field) is one undo step, clamped to the node's limits like a handle
 * drag (a shape's own minimum, 031). "Reset size" clears the stored size, back to the level's default.
 */
export function SizeFields({ node }: { node: Node }) {
  const editor = useEditor();
  const id = useId();
  const editable = useUiStore((s) => !isFlowMode(s) && s.flowSession === null);
  const size = cardSize(node, 'component');
  const limits = sizeLimitsOf(node);
  return (
    <PanelSection label="Size">
      <div className="flex items-end gap-2">
        <div className="grid flex-1 grid-cols-2 gap-2">
          {FIELDS.map(({ key, label }) => (
            <SizeField
              key={key}
              id={`${id}-${key}`}
              label={label}
              value={size[key]}
              disabled={!editable}
              onCommit={(value) => {
                const next = { ...size, [key]: clamp(value, limits.min[key], limits.max[key]) };
                oneStep(editor, () => {
                  editor.setCardSize(node.id, next);
                });
              }}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          disabled={!editable || node.size === undefined}
          onClick={() => {
            oneStep(editor, () => {
              editor.setCardSize(node.id, null);
            });
            useUiStore.getState().announce('Size reset');
          }}
        >
          Reset size
        </Button>
      </div>
    </PanelSection>
  );
}

function SizeField({
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
      onCommit(next);
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
