import {
  stickyCanvasPosition,
  stickyLabel,
  type FlowAnalysis,
  type PathStep,
} from '@sododeck/model';
import type { Flow, SododeckFile } from '@sododeck/schema';
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSection,
  PanelTitle,
} from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow } from '@xyflow/react';
import { ArrowRight, CircleAlert, GitBranch, Spline, Unlink } from 'lucide-react';
import { useMemo } from 'react';

import { NodeTypeTile } from '../shapes/shape-tile';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldEdit } from '../field-edit';
import { InspectorFrame } from '../inspector/inspector-frame';
import { nodeTitle, stepRoute } from './session-path';
import { AttachedRules } from '../fields/attached-rules';
import { protocolLabel } from '../fields/edge-choices';
import { FieldLabel } from '../fields/field-label';
import { LinksField } from '../fields/links-field';
import { MarkdownField } from '../fields/markdown-field';
import { oneStep } from '../fields/one-step';
import { OwnerField } from '../fields/owner-field';
import { TagsField } from '../fields/tags-field';
import { notesOnStep } from '../stickies/sticky-flow';

/** Flow mode (007): the current step's place on the played path. */
export interface StepPlayback {
  /** "Step 4 of 8", "Step 4b of 5". */
  label: string;
}

/**
 * Step inspector (006 FR-019, FR-027, 008 FR-011, designs 45, 46, 51): "Step n · <from> → <to>",
 * then title, markdown description, owner, the edge, tags, links, condition, SLA target (the target
 * only, no meter) and attached rules, editable in or out of a session. The branch step also lists
 * its branches. In flow mode (007 FR-019–021, designs 03, 24) the header shows the position, the
 * from/to tiles, protocol and branch instead.
 */
export function InspectorStep({
  deck,
  flow,
  analysis,
  step,
  playback,
}: {
  deck: SododeckFile;
  flow: Flow;
  analysis: FlowAnalysis;
  step: PathStep;
  playback?: StepPlayback;
}) {
  const editor = useEditor();
  const { getZoom, setCenter } = useReactFlow();
  const s = step.step;
  const stepNotes = useMemo(
    () => (step.from === null || step.to === null ? [] : notesOnStep(deck, step.from, step.to)),
    [deck, step.from, step.to],
  );
  const update = (patch: Parameters<typeof editor.updateStep>[2]) => {
    editor.updateStep(flow.id, s.id, patch);
  };
  const branch = analysis.branches.find((b) => b.branch.id === step.branchId);
  const where = branch === undefined ? `step ${step.number}` : `branch “${branch.branch.label}”`;
  const isFork = analysis.branchStepId === s.id;
  const Icon = isFork ? GitBranch : branch?.branch.errorPath === true ? CircleAlert : Spline;
  const edge = step.broken ? undefined : deck.edges.find((e) => e.id === s.edge);
  const edgeText =
    edge === undefined
      ? ''
      : [edge.label, protocolLabel(edge.protocol)]
          .filter((part) => part !== undefined && part !== '')
          .join(' · ') || stepRoute(deck, step);

  const body = (
    <>
      {isFork && (
        <PanelSection label="Branches after this step" aria-label="Branches after this step">
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
        <MarkdownField
          key={`${s.id}-description`}
          modeKey={`steps:${s.id}`}
          value={s.description ?? ''}
          placeholder="What happens in this step? Markdown supported."
          onCommit={(description) => {
            update({ description: description === '' ? null : description });
          }}
        />
      </PanelSection>
      <PanelSection className="grid grid-cols-2 gap-3">
        <OwnerField
          key={`${s.id}-owner`}
          deck={deck}
          value={s.owner ?? ''}
          onCommit={(owner) => {
            update({ owner: owner === '' ? null : owner });
          }}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <FieldLabel>Edge</FieldLabel>
          {edge === undefined ? (
            <p className="flex h-9 items-center gap-1.5 text-body-sm text-clay-ink">
              <Unlink aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
              Connection deleted
            </p>
          ) : (
            <p className="flex h-9 items-center truncate font-mono text-body-sm" title={edgeText}>
              {edgeText}
            </p>
          )}
        </div>
      </PanelSection>
      <PanelSection>
        <TagsField
          deck={deck}
          value={s.tags}
          onCommit={(tags) => {
            oneStep(editor, () => {
              update({ tags });
            });
          }}
        />
      </PanelSection>
      <PanelSection>
        <LinksField
          key={`${s.id}-links`}
          value={s.links}
          onCommit={(links) => {
            oneStep(editor, () => {
              update({ links });
            });
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
          placeholder={playback === undefined ? 'e.g. < 300 ms' : 'No SLA target'}
          onCommit={(sla) => {
            update({ sla: sla === '' ? null : sla });
          }}
        />
      </PanelSection>
      <AttachedRules
        deck={deck}
        host={{ kind: 'step', flowId: flow.id, stepId: s.id }}
        ruleIds={s.rules}
        inputs={s.ruleInputs}
      />
      {playback !== undefined && stepNotes.length > 0 && (
        <PanelSection label="NOTES ON THIS STEP" aria-label="NOTES ON THIS STEP">
          <ul role="list" className="flex flex-col gap-1.5">
            {stepNotes.map((sticky) => {
              const label = stickyLabel(sticky.text) ?? 'Empty note';
              const pinnedTo = deck.nodes.find((node) => node.id === sticky.anchor)?.title;
              if (pinnedTo === undefined) return null;
              return (
                <li key={sticky.id}>
                  <button
                    type="button"
                    aria-label={`${label}, pinned to ${pinnedTo}`}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded-card bg-surface-2 px-3 py-2 text-left hover:bg-surface-3',
                      focusRing,
                    )}
                    onClick={() => {
                      const point = stickyCanvasPosition(deck, sticky).point;
                      void setCenter(point.x, point.y, { zoom: getZoom() });
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span className="shrink-0 text-body-sm text-ink-secondary">
                      {`Pinned to ${pinnedTo}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PanelSection>
      )}
    </>
  );

  if (playback === undefined) {
    return (
      <InspectorFrame
        icon={<Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
        heading={`Step ${step.number} · ${stepRoute(deck, step)}`}
        subtitle={`${flow.title} · ${where}${step.broken ? ' · connection deleted' : ''}`}
      >
        {body}
      </InspectorFrame>
    );
  }
  return (
    <Panel aria-label="Inspector">
      <PlaybackHeader deck={deck} flow={flow} analysis={analysis} step={step} playback={playback} />
      <PanelContent>{body}</PanelContent>
    </Panel>
  );
}

function PlaybackHeader({
  deck,
  flow,
  analysis,
  step,
  playback,
}: {
  deck: SododeckFile;
  flow: Flow;
  analysis: FlowAnalysis;
  step: PathStep;
  playback: StepPlayback;
}) {
  const heading = `${playback.label} · ${flow.title}`;
  const branch = analysis.branches.find((b) => b.branch.id === step.branchId)?.branch;
  const edge = deck.edges.find((e) => e.id === step.step.edge);
  const protocol = protocolLabel(edge?.protocol);
  const kindOf = (id: string | null) => deck.nodes.find((n) => n.id === id)?.type ?? null;
  return (
    <PanelHeader className="h-auto flex-col items-stretch gap-2.5 py-3.5">
      <PanelTitle
        title={heading}
        className="text-caption font-semibold tracking-wide text-primary-ink uppercase"
      >
        {heading}
      </PanelTitle>
      {step.broken ? (
        <p className="flex items-center gap-1.5 text-body text-clay-ink">
          <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
          Connection deleted
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <NodeTypeTile
              type={kindOf(step.from)}
              size={30}
              label={`From: ${nodeTitle(deck, step.from)}`}
            />
            <ArrowRight
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="size-4 text-ink-muted"
            />
            <NodeTypeTile
              type={kindOf(step.to)}
              size={30}
              label={`To: ${nodeTitle(deck, step.to)}`}
            />
            {protocol !== undefined && (
              <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 font-mono text-caption text-ink-secondary">
                {protocol}
              </span>
            )}
          </div>
          <p className="text-title-sm text-ink">{stepRoute(deck, step)}</p>
          {edge?.label !== undefined && edge.label !== '' && (
            <p className="font-mono text-body-sm text-ink-secondary">{edge.label}</p>
          )}
        </>
      )}
      {branch !== undefined && (
        <p className="flex items-center gap-1.5 text-body-sm text-ink-secondary">
          {branch.errorPath === true ? (
            <CircleAlert
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="size-3.5 text-clay-ink"
            />
          ) : (
            <GitBranch aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          )}
          <span>Branch {branch.label}</span>
          {branch.errorPath === true && <span className="text-clay-ink">· Error path</span>}
        </p>
      )}
    </PanelHeader>
  );
}
