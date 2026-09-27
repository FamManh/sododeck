import type { FlowAnalysis, PathStep } from '@sododeck/model';
import type { Flow, SododeckFile } from '@sododeck/schema';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Ban } from 'lucide-react';

import { useEditor } from '../../model/use-editor';
import { useUiStore, type FlowSession } from '../../state/ui-store';
import { BranchHeader } from './branch-header';
import { stepIndexForMoveWithinPath } from './flow-order';
import { branchRefusal } from './flow-session';
import { invalidText } from './invalid-text';
import { RecordingHint } from './recording-hint';
import { stepCount } from './session-path';
import { StepRow } from './step-row';
import { useSortableList } from './use-sortable-list';
import { DeckEditError } from '@sododeck/model';

/** The rows of one path, sortable within the path while a session runs (FR-020). */
function PathRows({
  deck,
  flow,
  steps,
  analysis,
  errorPath,
  editing,
}: {
  deck: SododeckFile;
  flow: Flow;
  steps: readonly PathStep[];
  analysis: FlowAnalysis;
  errorPath: boolean;
  editing: boolean;
}) {
  const editor = useEditor();
  const branchStepId = analysis.branchStepId;
  const sort = useSortableList({
    ids: steps.map((s) => s.step.id),
    group: `steps:${steps[0]?.branchId ?? 'main'}`,
    // The branch step stays the last main-path step (clarification Q4).
    locked: (id) => id === branchStepId,
    onMove: (id, position) => {
      try {
        editor.moveStep(flow.id, id, stepIndexForMoveWithinPath(flow, id, position));
      } catch (error) {
        if (!(error instanceof DeckEditError)) throw error;
        useUiStore.getState().announce(error.issues[0]?.message ?? 'Not moved');
      }
    },
  });

  return (
    <>
      {steps.map((s, i) => (
        <StepRow
          key={s.step.id}
          deck={deck}
          flowId={flow.id}
          step={s}
          previousNumber={
            steps
              .slice(0, i)
              .filter((p) => !p.broken)
              .at(-1)?.number ?? null
          }
          errorPath={errorPath}
          editing={editing}
          canBranch={branchRefusal(analysis, s.step.id) === null}
          sortable={
            editing
              ? {
                  row: sort.rowProps(s.step.id),
                  grip: sort.gripProps(s.step.id),
                  dragging: sort.drag?.id === s.step.id,
                }
              : null
          }
        />
      ))}
    </>
  );
}

/**
 * The ordered steps of a flow (designs 42–46): main path, then each branch under its "◇" header,
 * numbered 1…n, 4a, 4b. In a session: the refused-click message and the hint card.
 */
export function StepList({
  deck,
  flow,
  analysis,
  session,
}: {
  deck: SododeckFile;
  flow: Flow | undefined;
  analysis: FlowAnalysis | null;
  session: FlowSession | null;
}) {
  const editing = session !== null;
  const empty = analysis === null || analysis.byStepId.size === 0;
  const invalid = session?.invalid ?? null;
  const newBranchId =
    session?.addingBranch === true && session.target.kind === 'branch'
      ? session.target.branchId
      : null;

  return (
    <section aria-labelledby="flow-steps-heading" className="flex flex-col gap-2">
      <h3
        id="flow-steps-heading"
        className="flex items-center justify-between text-micro text-ink-muted uppercase"
      >
        Steps
        <span className="normal-case">{stepCount(analysis)}</span>
      </h3>
      {empty && <p className="text-body-sm text-ink-muted">No steps yet</p>}
      {flow !== undefined && analysis !== null && !empty && (
        <ol aria-label="Steps" className="flex flex-col">
          <PathRows
            deck={deck}
            flow={flow}
            steps={analysis.main}
            analysis={analysis}
            errorPath={false}
            editing={editing}
          />
          {analysis.branches.map((path) => (
            <li key={path.branch.id} className="flex flex-col">
              <ol aria-label={`Branch ${path.letter}`} className="flex flex-col pl-3">
                <BranchHeader path={path} isNew={path.branch.id === newBranchId} />
                <PathRows
                  deck={deck}
                  flow={flow}
                  steps={path.steps}
                  analysis={analysis}
                  errorPath={path.branch.errorPath === true}
                  editing={editing}
                />
              </ol>
            </li>
          ))}
        </ol>
      )}
      {session !== null && invalid !== null && (
        <div className="flex items-start gap-2 rounded-card bg-clay-soft px-3 py-2 text-body-sm text-clay-ink">
          <Ban aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="mt-0.5 size-4 shrink-0" />
          <span className="flex flex-col">
            <span className="font-medium">Edge not added</span>
            <span>
              {(() => {
                const text = invalidText(deck, analysis, session, invalid);
                return `${text.route} doesn't start at ${text.start}.`;
              })()}
            </span>
          </span>
        </div>
      )}
      {session !== null && <RecordingHint deck={deck} session={session} />}
    </section>
  );
}
