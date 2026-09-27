import type { BranchPath } from '@sododeck/model';
import type { Flow } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { Switch } from '@sododeck/ui/components/switch';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { CircleAlert, GitBranch, Trash2 } from 'lucide-react';
import { useEffect, useId } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldEdit } from '../field-edit';
import { InspectorFrame } from '../inspector/inspector-frame';

/**
 * Branch inspector (FR-022, FR-023, FR-028, designs 45–46): label, condition and the Error path
 * switch. While the branch is being added the fields are required: Done with an empty one shows an
 * inline error under it and moves focus to the first.
 */
export function InspectorBranch({
  flow,
  path,
  afterNumber,
  adding,
}: {
  flow: Flow;
  path: BranchPath;
  afterNumber: string;
  adding: boolean;
}) {
  const editor = useEditor();
  const check = useUiStore((s) => s.flowSession?.branchCheck ?? 0);
  const session = useUiStore((s) => s.flowSession);
  const labelId = useId();
  const conditionId = useId();
  const switchId = useId();
  const { branch } = path;
  const showErrors = adding && check > 0;
  const labelError = showErrors && branch.label.trim() === '' ? 'Enter a label' : undefined;
  const conditionError =
    showErrors && branch.condition.trim() === '' ? 'Enter a condition' : undefined;

  // Each refused Done moves focus to the first empty field.
  useEffect(() => {
    if (check === 0) return;
    const first =
      labelError !== undefined ? labelId : conditionError !== undefined ? conditionId : null;
    if (first !== null) document.getElementById(first)?.focus();
    // Only on a new press, not while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check]);

  const update = (patch: Parameters<typeof editor.updateBranch>[2]) => {
    editor.updateBranch(flow.id, branch.id, patch);
  };
  const error = branch.errorPath === true;

  return (
    <InspectorFrame
      icon={
        error ? (
          <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />
        ) : (
          <GitBranch aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />
        )
      }
      heading={adding ? 'New branch' : `Branch ${path.letter} · ${branch.label || 'no label yet'}`}
      subtitle={`${flow.title} · after step ${afterNumber}`}
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete branch…"
          onClick={() => {
            useUiStore
              .getState()
              .requestRemoval([{ scope: 'branches', flowId: flow.id, id: branch.id }]);
          }}
        >
          <Trash2 />
        </Button>
      }
    >
      <PanelSection>
        <FieldEdit
          key={`${branch.id}-label`}
          id={labelId}
          label={adding ? 'New branch · Label' : 'Label'}
          value={branch.label}
          allowEmpty
          placeholder="e.g. payment failed"
          error={labelError}
          onCommit={(label) => {
            update({ label });
          }}
        />
      </PanelSection>
      <PanelSection>
        <FieldEdit
          key={`${branch.id}-condition`}
          id={conditionId}
          label="Condition"
          value={branch.condition}
          allowEmpty
          mono
          placeholder='e.g. payment.status == "declined"'
          error={conditionError}
          onCommit={(condition) => {
            update({ condition });
          }}
        />
      </PanelSection>
      <PanelSection>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <label htmlFor={switchId} className="text-body text-ink">
              Error path
            </label>
            <span id={`${switchId}-description`} className="text-caption text-ink-secondary">
              Draws dashed with an error icon
            </span>
          </div>
          <Switch
            id={switchId}
            checked={error}
            aria-describedby={`${switchId}-description`}
            onCheckedChange={(checked) => {
              update({ errorPath: checked ? true : null });
            }}
          />
        </div>
      </PanelSection>
      {adding && session !== null && path.steps.length === 0 && (
        <PanelSection>
          <p className="text-body-sm text-ink-secondary">
            Now pick the first edge of this branch on the canvas.
          </p>
        </PanelSection>
      )}
    </InspectorFrame>
  );
}
