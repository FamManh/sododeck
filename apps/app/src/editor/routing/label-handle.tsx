/**
 * The draggable, focusable label of the selected connector (022 US4, frame 130): a transparent
 * button laid over the label pill. Dragging slides the label along the line with ticks at
 * 25 / 50 / 75 % and snapping (⌘ turns that off); ← / → 5 %, Shift + ← / → ticks, Home / End the
 * clamped ends, ⏎ edits the text. The live position is UI state; the document is written once,
 * on release (`setEdgeLabelAt`).
 */
import type { Id } from '@sododeck/schema';
import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import {
  labelFromPoint,
  labelRange,
  labelReadout,
  LABEL_TICKS,
  stepLabel,
} from '../editing/label-drag';
import { oneStep } from '../fields/one-step';
import { labelPoint, type PathSamples } from './connector-geometry';

export interface LabelHandleProps {
  edgeId: Id;
  /** The label text (for the accessible name). */
  text: string;
  /** The stored position, or 0.5. */
  at: number;
  samples: PathSamples;
  /** Distance the pill keeps from each end. */
  clamp: number;
  /** The pill's estimated width, for the hit area. */
  width: number;
  /** Where the pill sits when not being dragged (the line's middle when `labelAt` is unset). */
  rest: { x: number; y: number };
}

const pct = (at: number): string => String(Math.round(at * 100));

export function LabelHandle({ edgeId, text, at, samples, clamp, width, rest }: LabelHandleProps) {
  const editor = useEditor();
  const { screenToFlowPosition } = useReactFlow();
  const [dragging, setDragging] = useState(false);
  const live = useRef<{ at: number; snapped: boolean } | null>(null);
  const preview = useUiStore((s) => (s.labelPreview?.edgeId === edgeId ? s.labelPreview : null));
  const current = preview?.at ?? at;
  const point = preview === null ? rest : labelPoint(samples, preview.at, clamp);
  const range = labelRange(samples.total, clamp);

  function write(next: number) {
    oneStep(editor, () => {
      editor.setEdgeLabelAt(edgeId, next);
    });
    useUiStore.getState().announce(labelReadout(next));
  }

  function finish() {
    useUiStore.getState().setLabelPreview(null);
    useUiStore.getState().setConnectorReadout(null);
    if (useUiStore.getState().canvasGesture === 'label')
      useUiStore.getState().setCanvasGesture(null);
    live.current = null;
    setDragging(false);
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    useUiStore.getState().setCanvasGesture('label');
    live.current = { at: current, snapped: false };
    setDragging(true);
  }
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (live.current === null) return;
    const hit = labelFromPoint(
      samples,
      screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      clamp,
      { mod: event.metaKey || event.ctrlKey },
    );
    live.current = hit;
    const ui = useUiStore.getState();
    ui.setLabelPreview({ edgeId, ...hit });
    ui.setConnectorReadout(labelReadout(hit.at, hit.snapped));
  }
  function onPointerUp() {
    const hit = live.current;
    finish();
    if (hit !== null && hit.at !== at) write(hit.at);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter') {
      const ui = useUiStore.getState();
      ui.select({ edges: [edgeId] });
      ui.openEdgePopover(edgeId);
    } else if (event.key === 'Escape' && dragging) {
      finish();
    } else {
      const next = stepLabel(at, event.key, event.shiftKey, range);
      if (next === null) return;
      if (next !== at) write(next);
    }
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        aria-label={`Label ${text}, ${pct(current)} % along`}
        data-testid="label-handle"
        className="nodrag nopan absolute cursor-grab rounded-full bg-transparent active:cursor-grabbing"
        style={{
          left: point.x,
          top: point.y,
          width: Math.max(32, width),
          height: 24,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'all',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      />
      {dragging &&
        LABEL_TICKS.map((tick) => {
          const p = labelPoint(samples, tick, 0);
          return (
            <span
              key={tick}
              aria-hidden
              data-testid="label-tick"
              className="pointer-events-none absolute size-1.5 rounded-full bg-primary"
              style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)' }}
            />
          );
        })}
      {dragging && preview !== null && (
        <span
          className="sd-route-readout"
          aria-hidden
          data-testid="label-readout"
          style={{ left: point.x + 16, top: point.y + 16 }}
        >
          {labelReadout(preview.at, preview.snapped)}
        </span>
      )}
    </EdgeLabelRenderer>
  );
}
