import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { BranchPicker } from './branch-picker';
import { usePlayback } from './use-playback';
import { goToStep, nextStep, play, playbackOf, previousStep } from './flow-mode';
import type { Segment } from './played-path';
import { findFlow, stepRoute } from './session-path';

function segmentName(segment: Segment, total: number): string {
  return `Go to step ${segment.number} of ${String(total)}${segment.errorPath ? ', error path' : ''}${segment.broken ? ', connection deleted' : ''}`;
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
  const playback = useMemo(
    () => (flow === undefined ? null : playbackOf(deck, flow, alternativeId, stepId)),
    [deck, flow, alternativeId, stepId],
  );
  const progress = useRef<HTMLOListElement>(null);
  usePlayback();
  const currentId = playback?.currentStepId ?? null;

  // Long flows scroll horizontally; keep the current segment in view.
  useEffect(() => {
    if (currentId === null) return;
    const el = progress.current?.querySelector<HTMLElement>(`[data-step-id="${currentId}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [currentId]);

  if (active === null || playback === null) return null;
  const { view } = playback;
  const current = currentId === null ? undefined : playback.analysis.byStepId.get(currentId);
  const title = current === undefined ? '' : (current.step.title ?? stepRoute(deck, current));
  const empty = view === null;
  const playing = active.playing;

  return (
    <section
      aria-label="Step player"
      className="pointer-events-auto flex w-[min(560px,calc(100vw-2rem))] min-w-[420px] flex-col gap-2.5 rounded-[18px] border border-hairline bg-surface px-4 py-3 shadow-float"
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
          <span className="truncate text-body-sm text-ink-secondary">
            {playback.flow.title} · {view === null ? 'No steps' : view.label}
          </span>
          {title !== '' && (
            <span className="truncate text-body font-medium text-ink" title={title}>
              {title}
            </span>
          )}
        </div>
        <Button
          size="sm"
          aria-label={`Speed ${String(active.speed)}×`}
          disabled={empty}
          className="font-mono"
          onClick={() => {
            useUiStore.getState().setSpeed(active.speed === 1 ? 2 : 1);
          }}
        >
          {`${String(active.speed)}×`}
        </Button>
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
                className={cn('flex h-3 w-full cursor-pointer items-center rounded-sm', focusRing)}
              >
                <span
                  aria-hidden
                  className={cn(
                    'h-1 w-full rounded-full',
                    segment.errorPath || segment.broken
                      ? segment.filled
                        ? 'text-clay-ink'
                        : 'text-ink-muted'
                      : segment.filled
                        ? 'bg-primary'
                        : 'bg-surface-3',
                    segment.errorPath && 'sd-segment-error',
                    segment.broken && 'sd-segment-broken',
                    segment.current && 'h-1.5',
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
