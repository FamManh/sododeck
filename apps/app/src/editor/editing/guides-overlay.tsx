/**
 * What a drag draws over the canvas (016, DESIGN.md "Snap guide", screens 109–111): 1 px Deck
 * Orange guides with Mono distance and equal-gap labels, the dashed ghost of a dragged frame's
 * start with its offset readout, and the dashed slot a card lands in. All from UI-only store
 * fields, in canvas coordinates (a `ViewportPortal`); labels keep their screen size at any zoom.
 * Decorative (`aria-hidden`): the hint bar and the announcements carry the same information.
 */
import { cn } from '@sododeck/ui/lib/utils';
import { useStore, ViewportPortal, type ReactFlowState } from '@xyflow/react';
import type { CSSProperties, ReactNode } from 'react';

import { useUiStore, type Guide } from '../../state/ui-store';
import { displayPosition, groupBounds, cardSize, type Point, type Rect } from '../canvas-geometry';
import { levelForZoom } from '../levels';
import { useViewState } from '../views/use-current-view';

const zoomSelector = (s: ReactFlowState) => s.transform[2];

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${String(Math.abs(Math.round(n)))}`;

/** A pill label at a canvas point that keeps its screen size (Mono 10.5, 18 tall). */
function Label({
  at,
  zoom,
  children,
  className,
  testId,
}: {
  at: Point;
  zoom: number;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'absolute flex h-4.5 origin-top-left items-center rounded-full bg-primary px-1.5 font-mono text-[10.5px] leading-none whitespace-nowrap text-on-primary',
        className,
      )}
      style={{
        left: at.x,
        top: at.y,
        transform: `scale(${String(1 / zoom)}) translate(-50%, -50%)`,
      }}
    >
      {children}
    </span>
  );
}

function GuideLine({ guide, zoom }: { guide: Guide; zoom: number }) {
  const width = 1 / zoom;
  const style: CSSProperties =
    guide.axis === 'x'
      ? { left: guide.at - width / 2, top: guide.from, width, height: guide.to - guide.from }
      : {
          top: guide.at - width / 2,
          left: guide.from,
          height: width,
          width: guide.to - guide.from,
        };
  return (
    <>
      <span data-guide={guide.axis} className="absolute bg-primary" style={style} />
      {guide.distance !== undefined && (
        <Label at={guide.distance.at} zoom={zoom}>
          {String(guide.distance.value)}
        </Label>
      )}
      {guide.equalGaps?.map((gap) => (
        <Label
          key={`${String(gap.at.x)},${String(gap.at.y)}`}
          at={gap.at}
          zoom={zoom}
          className="outline-1 outline-dashed outline-primary outline-offset-2"
        >
          {String(gap.value)}
        </Label>
      ))}
    </>
  );
}

function DashedBox({ rect, zoom, testId }: { rect: Rect; zoom: number; testId: string }) {
  return (
    <span
      data-testid={testId}
      className="absolute rounded-group border-dashed border-primary"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderWidth: 1.5 / zoom,
      }}
    />
  );
}

export function GuidesOverlay() {
  const guides = useUiStore((s) => s.guides);
  const readout = useUiStore((s) => s.dragReadout);
  const resizeReadout = useUiStore((s) => s.resizeReadout);
  const gesture = useUiStore((s) => s.canvasGesture);
  const dropTarget = useUiStore((s) => s.dropTarget);
  const selection = useUiStore((s) => s.selection);
  const zoom = useStore(zoomSelector);
  const view = useViewState();
  if (guides.length === 0 && readout === null && resizeReadout === null && dropTarget === null)
    return null;

  const level = levelForZoom(zoom);
  const bounds = groupBounds(view.deck, level);
  const ghosts =
    gesture === 'group-drag' && readout !== null
      ? selection.groups.flatMap((id) => {
          const rect = bounds.get(id);
          return rect === undefined
            ? []
            : [{ ...rect, x: rect.x - readout.dx, y: rect.y - readout.dy }];
        })
      : [];
  const moving = new Set(selection.nodes);
  const slots =
    gesture === 'drag' && dropTarget !== null
      ? view.deck.nodes.flatMap((node, index) =>
          moving.has(node.id)
            ? [{ ...displayPosition(node, index), ...cardSize(node, level) }]
            : [],
        )
      : [];
  const lead = ghosts[0];

  return (
    <ViewportPortal>
      <div aria-hidden className="pointer-events-none absolute top-0 left-0">
        {guides.map((guide) => (
          <GuideLine key={`${guide.axis}:${String(guide.at)}`} guide={guide} zoom={zoom} />
        ))}
        {ghosts.map((rect) => (
          <DashedBox
            key={`${String(rect.x)},${String(rect.y)}`}
            rect={rect}
            zoom={zoom}
            testId="drag-ghost"
          />
        ))}
        {lead !== undefined && readout !== null && (
          <Label
            at={{ x: lead.x + readout.dx + lead.width, y: lead.y + readout.dy - 12 / zoom }}
            zoom={zoom}
            className="bg-inverse text-on-inverse"
          >
            {`${signed(readout.dx)}, ${signed(readout.dy)}`}
          </Label>
        )}
        {resizeReadout !== null && (
          <Label
            at={{
              x: resizeReadout.x + resizeReadout.width,
              y: resizeReadout.y + resizeReadout.height + 12 / zoom,
            }}
            zoom={zoom}
            className="bg-inverse text-on-inverse"
            testId="resize-readout"
          >
            {`${String(resizeReadout.width)} × ${String(resizeReadout.height)}`}
          </Label>
        )}
        {slots.map((rect) => (
          <DashedBox
            key={`${String(rect.x)},${String(rect.y)}`}
            rect={{ x: rect.x - 4, y: rect.y - 4, width: rect.width + 8, height: rect.height + 8 }}
            zoom={zoom}
            testId="landing-slot"
          />
        ))}
      </div>
    </ViewportPortal>
  );
}
