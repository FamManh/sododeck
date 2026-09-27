import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowLeft, ListOrdered, Route } from 'lucide-react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldEdit } from '../field-edit';
import { openFlow } from './flow-mode';
import { featureOf, flowsIn } from './flow-order';
import { analysisOf, sessionTitle, startEditing } from './flow-session';
import { findFlow } from './session-path';
import { StepList } from './step-list';

/**
 * The left panel while a flow is shown or recorded (designs 41–46): the flow's feature and name,
 * its steps and, in a session, the hint. Outside a session it also lists the feature's flows.
 */
export function FlowPanel({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const session = useUiStore((s) => s.flowSession);
  const activeFlowId = useUiStore((s) => s.activeFlow?.flowId ?? null);
  const flowId = session?.flowId ?? activeFlowId;
  const flow = findFlow(deck, flowId);
  const analysis = analysisOf(deck, flowId);
  const featureId = flow === undefined ? (session?.featureId ?? null) : featureOf(deck, flow);
  const featureName = deck.features.find((f) => f.id === featureId)?.title ?? 'No feature';
  const ui = () => useUiStore.getState();

  if (session !== null) {
    const title = sessionTitle(deck, session);
    return (
      <PanelSection
        label={
          session.mode === 'record'
            ? `New flow · ${featureName}`
            : `${flow?.title ?? title} · Steps`
        }
      >
        <FieldEdit
          key={flow?.id ?? 'pending'}
          label="Flow name"
          value={title}
          onCommit={(next) => {
            if (flow !== undefined) editor.update('flows', flow.id, { title: next });
            else ui().startRecording(next, session.featureId);
          }}
        />
        <StepList deck={deck} flow={flow} analysis={analysis} session={session} />
      </PanelSection>
    );
  }

  if (flow === undefined) return null;
  const siblings = flowsIn(deck, featureId);
  return (
    <>
      <PanelSection>
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            ui().setActiveFlow(null);
          }}
        >
          <ArrowLeft />
          Back to canvas
        </Button>
      </PanelSection>
      <PanelSection label={`${featureName} · Flows`}>
        <ul aria-label={`Flows in ${featureName}`} className="flex flex-col">
          {siblings.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                aria-current={f.id === flow.id ? 'true' : undefined}
                className={cn(
                  'flex h-9 w-full cursor-pointer items-center gap-2 rounded-row px-2 text-left text-body',
                  f.id === flow.id ? 'bg-primary-soft text-primary-ink' : 'hover:bg-surface-2',
                  focusRing,
                )}
                onClick={() => {
                  openFlow(editor, f.id);
                }}
              >
                <Route aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{f.title}</span>
                <span className="text-caption text-ink-muted">
                  {f.steps.length} {f.steps.length === 1 ? 'step' : 'steps'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PanelSection>
      <PanelSection>
        <StepList deck={deck} flow={flow} analysis={analysis} session={null} />
        <Button
          size="sm"
          className="self-start"
          onClick={() => {
            startEditing(editor, flow.id);
          }}
        >
          <ListOrdered />
          Edit steps
        </Button>
      </PanelSection>
    </>
  );
}
