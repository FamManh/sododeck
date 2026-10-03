import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { groupAtStep } from '../collapse-flow-marks';
import { scopeOf, visibleGraph } from '../visible-graph';
import { useCollapsed } from '../views/use-current-view';
import { BranchPicker } from './branch-picker';
import { usePlayback } from './use-playback';
import { goToStep, nextStep, play, playbackOf, previousStep } from './flow-mode';
import type { Segment } from './played-path';
import { findFlow, stepRoute } from './session-path';
import { NotesDisplayMenu } from './notes-display-menu';

function segmentName(segment: Segment, total: number): string {
  return `Go to step ${segment.number} of ${String(total)}${segment.errorPath ? ', error path' : ''}${segment.broken ? ', connection deleted' : ''}`;
}

function segmentState(segment: Segment): 'played' | 'current' | 'upcoming' {
  if (segment.current) return 'current';
  return segment.filled ? 'played' : 'upcoming';
}

/**
 * The step player of flow mode (007 contracts/flow-playback-ui.md, designs 03, 26, 46): previous /
 * play / next, the position and step title, speed, the progress segments and, from the fork on,
 * the branch picker. Reads the open flow from the store and the deck; writes through `flow-mode`.
 */
export function StepPlayer({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const active = useUiStore((s) => s.activeFlow);
  const flowMode = useUiStore(isFlowMode);
  const flow = flowMode ? findFlow(deck, active?.flowId ?? null) : undefined;
  const alternativeId = active?.alternativeId ?? null;
  const stepId = active?.stepId ?? null;
  const drill = useUiStore((s) => s.drill);
  const collapsed = useCollapsed();
  const playback = useMemo(
    () => (flow === undefined ? null : playbackOf(deck, flow, alternativeId, stepId)),
    [deck, flow, alternativeId, stepId],
  );
  const graph = useMemo(
    () => visibleGraph(deck, scopeOf(drill), collapsed),
    [deck, drill, collapsed],
  );
  const progress = useRef<HTMLOListElement>(null);
  usePlayback();
  const currentId = playback?.currentStepId ?? null;

  // Long flows scroll horizontally; keep the current segment in view. Only the list scrolls:
  // scrollIntoView would also scroll the canvas's ancestors.
  useEffect(() => {
    const list = progress.current;
    if (currentId === null || list === null || list.scrollWidth <= list.clientWidth) return;
    const el = list.querySelector<HTMLElement>(`[data-step-id="${currentId}"]`);
    if (el === null) return;
    const left = el.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft) list.scrollLeft = left;
    else if (left + el.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = left + el.offsetWidth - list.clientWidth;
    }
  }, [currentId]);

  if (active === null || playback === null) return null;
  const { view } = playback;
  const current = currentId === null ? undefined : playback.analysis.byStepId.get(currentId);
  const title = current === undefined ? '' : (current.step.title ?? stepRoute(deck, current));
  const insideGroup = current === undefined ? null : groupAtStep(deck, graph, current.step.edge);
  const empty = view === null;
  const playing = active.playing;

  return (
    <section
      aria-label="Step player"
      className="pointer-events-auto flex w-[min(560px,calc(100vw-2rem))] min-w-[420px] flex-col gap-2.5 rounded-[16px] border-[1.5px] border-border-strong bg-surface px-4 py-3 shadow-[0_3px_0_0_var(--color-border-strong),0_8px_28px_var(--sd-shadow)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            aria-label="Previous step"
            disabled={view?.previous == null}
            onClick={() => {
              previousStep(editor);
            }}
          >
            <SkipBack strokeWidth={ICON_STROKE_WIDTH} />
          </Button>
          <Button
            size="icon"
            variant="primary"
            // 40px and round, on an Orange Ink lip (035 FR-015).
            className="size-10 rounded-full shadow-[0_3px_0_0_var(--color-deck-orange-ink)]"
            aria-label={playing ? 'Pause' : 'Play'}
            aria-pressed={playing}
            disabled={empty}
            onClick={() => {
              if (playing) useUiStore.getState().setPlaying(false);
              else play(editor);
            }}
          >
            {playing ? (
              <Pause strokeWidth={ICON_STROKE_WIDTH} />
            ) : (
              <Play strokeWidth={ICON_STROKE_WIDTH} />
            )}
          </Button>
          <Button
            size="icon"
            aria-label="Next step"
            disabled={view?.next == null}
            onClick={() => {
              nextStep(editor);
            }}
          >
            <SkipForward strokeWidth={ICON_STROKE_WIDTH} />
          </Button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] leading-tight font-bold text-ink">
            {playback.flow.title} · {view === null ? 'No steps' : view.label}
          </span>
          {title !== '' && (
            <span className="truncate text-body-sm text-ink-secondary" title={title}>
              {title}
              {insideGroup !== null && (
                <span className="text-ink-muted">{` · inside ${insideGroup}`}</span>
              )}
            </span>
          )}
        </div>
        <Button
          size="sm"
          aria-label={`Speed ${String(active.speed)}×`}
          disabled={empty}
          className="rounded-full bg-surface-2 font-mono"
          onClick={() => {
            useUiStore.getState().setSpeed(active.speed === 1 ? 2 : 1);
          }}
        >
          {`${String(active.speed)}×`}
        </Button>
        <NotesDisplayMenu />
      </div>
      {view !== null && (
        <ol
          ref={progress}
          aria-label="Progress"
          className="flex gap-1 overflow-x-auto [scrollbar-width:none]"
        >
          {view.segments.map((segment) => (
            <li key={segment.stepId} data-step-id={segment.stepId} className="min-w-3 flex-1">
              <button
                type="button"
                aria-label={segmentName(segment, view.total)}
                aria-current={segment.current ? 'step' : undefined}
                onClick={() => {
                  goToStep(editor, segment.stepId);
                }}
                className={cn('flex h-4 w-full cursor-pointer items-center rounded-sm', focusRing)}
              >
                <span
                  aria-hidden
                  data-segment-state={segmentState(segment)}
                  {...(segment.nextFork ? { 'data-next-fork': '' } : {})}
                  className={cn(
                    'h-2 w-full rounded-full',
                    segment.errorPath || segment.broken
                      ? segment.filled
                        ? 'text-clay-ink'
                        : 'text-ink-muted'
                      : segment.current
                        ? 'bg-deck-orange'
                        : segment.filled
                          ? 'bg-ink-secondary'
                          : 'bg-surface-3',
                    segment.errorPath && 'sd-segment-error',
                    segment.broken && 'sd-segment-broken',
                    // The next branch point: a dashed outline, a shape cue and not only a colour.
                    segment.nextFork &&
                      'outline-[1.5px] outline-offset-1 outline-ink-secondary outline-dashed',
                  )}
                />
              </button>
            </li>
          ))}
        </ol>
      )}
      {view?.showPicker === true && view.forkNumber !== null && (
        <BranchPicker
          analysis={playback.analysis}
          played={playback.played}
          forkNumber={view.forkNumber}
        />
      )}
    </section>
  );
}
