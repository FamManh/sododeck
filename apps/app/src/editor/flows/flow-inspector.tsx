import type { SododeckFile } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Route } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { analysisOf } from './flow-session';
import { InspectorBranch } from './inspector-branch';
import { InspectorFlow } from './inspector-flow';
import { InspectorFrame } from '../inspector/inspector-frame';
import { InspectorStep } from './inspector-step';
import { findFlow } from './session-path';

/**
 * The inspector while a flow is shown or recorded: the branch being added or selected, else the
 * selected step, else the flow. Returns null when no flow is involved.
 */
export function FlowInspector({ deck }: { deck: SododeckFile }) {
  const session = useUiStore((s) => s.flowSession);
  const active = useUiStore((s) => s.activeFlow);
  const flowId = session?.flowId ?? active?.flowId ?? null;
  if (session === null && active === null) return null;

  const flow = findFlow(deck, flowId);
  if (flow === undefined) {
    // Recording a new flow before its first step.
    return (
      <InspectorFrame
        icon={<Route aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
        heading={session?.pendingTitle ?? 'New flow'}
        subtitle="Flow · recording"
      >
        <PanelSection>
          <p className="text-body-sm text-ink-secondary">
            Click a connection on the canvas to add step 1.
          </p>
        </PanelSection>
      </InspectorFrame>
    );
  }
  const analysis = analysisOf(deck, flow.id);
  if (analysis === null) return null;
  const forkNumber =
    analysis.branchStepId === null
      ? ''
      : (analysis.byStepId.get(analysis.branchStepId)?.number ?? '');

  const adding =
    session?.addingBranch === true && session.target.kind === 'branch'
      ? session.target.branchId
      : null;
  const branchId = adding ?? active?.branchId ?? null;
  const path = analysis.branches.find((b) => b.branch.id === branchId);
  if (path !== undefined) {
    return (
      <InspectorBranch
        key={path.branch.id}
        flow={flow}
        path={path}
        afterNumber={forkNumber}
        adding={adding === path.branch.id}
      />
    );
  }
  const step = active?.stepId == null ? undefined : analysis.byStepId.get(active.stepId);
  if (step !== undefined) {
    return <InspectorStep deck={deck} flow={flow} analysis={analysis} step={step} />;
  }
  return <InspectorFlow deck={deck} flow={flow} />;
}
