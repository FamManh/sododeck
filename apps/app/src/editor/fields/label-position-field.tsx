import type { Edge } from '@sododeck/schema';
import { Input } from '@sododeck/ui/components/input';
import { useId, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { oneStep } from './one-step';

/**
 * "Label position" in the drawer (022 US4): where the label sits along the line, 0 to 100 %, in
 * steps of 5; an unset position shows 50 %. Commits on Enter or blur as one undo step.
 */
export function LabelPositionField({ edge }: { edge: Edge }) {
  const editor = useEditor();
  const id = useId();
  const editable = useUiStore((s) => !isFlowMode(s) && s.flowSession === null);
  const stored = Math.round((edge.labelAt ?? 0.5) * 100);
  const [draft, setDraft] = useState<string | null>(null);

  const done = () => {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || !Number.isFinite(next)) return;
    const percent = Math.max(0, Math.min(100, Math.round(next)));
    if (percent === stored) return;
    oneStep(editor, () => {
      editor.setEdgeLabelAt(edge.id, percent / 100);
    });
    useUiStore.getState().announce(`Label ${String(percent)} %`);
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-caption text-ink-secondary">
        Label position
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={5}
          disabled={!editable}
          className="w-20"
          value={draft ?? String(stored)}
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
        <span className="text-body-sm text-ink-secondary">% along the line</span>
      </div>
    </div>
  );
}
