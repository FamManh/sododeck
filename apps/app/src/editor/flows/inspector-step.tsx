import type { FlowAnalysis, PathStep } from '@sododeck/model';
import type { Flow, SododeckFile } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowRight, CircleAlert, GitBranch, Spline } from 'lucide-react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldEdit } from '../field-edit';
import { InspectorFrame } from './inspector-frame';
import { stepRoute } from './session-path';
import { TextareaEdit } from './textarea-edit';

/**
 * Step inspector (FR-019, FR-027, designs 45–46): "Step n · <from> → <to>", then title,
 * description, condition and SLA target, editable in or out of a session. The branch step also
 * lists its branches.
 */
export function InspectorStep({
  deck,
  flow,
  analysis,
  step,
}: {
  deck: SododeckFile;
  flow: Flow;
  analysis: FlowAnalysis;
  step: PathStep;
}) {
  const editor = useEditor();
  const s = step.step;
  const update = (patch: Parameters<typeof editor.updateStep>[2]) => {
    editor.updateStep(flow.id, s.id, patch);
  };
  const branch = analysis.branches.find((b) => b.branch.id === step.branchId);
  const where = branch === undefined ? `step ${step.number}` : `branch “${branch.branch.label}”`;
  const isFork = analysis.branchStepId === s.id;
  const Icon = isFork ? GitBranch : branch?.branch.errorPath === true ? CircleAlert : Spline;

  return (
    <InspectorFrame
      icon={<Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={`Step ${step.number} · ${stepRoute(deck, step)}`}
      subtitle={`${flow.title} · ${where}${step.broken ? ' · connection deleted' : ''}`}
    >
      {isFork && (
        <PanelSection label="Branches after this step">
          <ul className="flex flex-col gap-1.5">
            {analysis.branches.map((b) => (
              <li key={b.branch.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-card bg-surface-2 px-3 py-2 text-left hover:bg-surface-3',
                    focusRing,
                  )}
                  onClick={() => {
                    useUiStore.getState().setActiveBranch(b.branch.id);
                  }}
                >
                  {b.branch.errorPath === true ? (
                    <CircleAlert
                      aria-hidden
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="size-4 shrink-0 text-clay-ink"
                    />
                  ) : (
                    <GitBranch
                      aria-hidden
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="size-4 shrink-0"
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body">
                      {b.letter} · {b.branch.label === '' ? 'no label yet' : b.branch.label}
                    </span>
                    {b.branch.condition !== '' && (
                      <span className="truncate font-mono text-caption text-ink-secondary">
                        {b.branch.condition}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 text-caption text-ink-secondary">
                    <ArrowRight aria-hidden className="size-3" />
                    {b.steps[0]?.number ?? 'no steps'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
      <PanelSection>
        <FieldEdit
          key={`${s.id}-title`}
          label="Title"
          value={s.title ?? ''}
          allowEmpty
          placeholder={stepRoute(deck, step)}
          onCommit={(title) => {
            update({ title: title === '' ? null : title });
          }}
        />
      </PanelSection>
      <PanelSection>
        <TextareaEdit
          key={`${s.id}-description`}
          label="Description"
          value={s.description ?? ''}
          placeholder="What happens in this step? Markdown supported."
          onCommit={(description) => {
            update({ description: description === '' ? null : description });
          }}
        />
      </PanelSection>
      <PanelSection>
        <FieldEdit
          key={`${s.id}-condition`}
          label="Condition"
          value={s.condition ?? ''}
          allowEmpty
          mono
          placeholder='e.g. payment.status == "authorized"'
          onCommit={(condition) => {
            update({ condition: condition === '' ? null : condition });
          }}
        />
      </PanelSection>
      <PanelSection>
        <FieldEdit
          key={`${s.id}-sla`}
          label="SLA target"
          value={s.sla ?? ''}
          allowEmpty
          mono
          placeholder="e.g. < 300 ms"
          onCommit={(sla) => {
            update({ sla: sla === '' ? null : sla });
          }}
        />
      </PanelSection>
    </InspectorFrame>
  );
}
