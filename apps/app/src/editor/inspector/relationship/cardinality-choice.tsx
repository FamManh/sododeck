import type { Cardinality, Edge } from '@sododeck/schema';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

import { cardinalityLabel } from '../../actions/relationship-actions';
import { crowPath } from '../../edge-end-marks';
import { endOf } from '../../relationships/relationship-ends';

const CHOICES: readonly Cardinality[] = ['1-1', '1-n', 'n-1', 'n-n'];

const WIDTH = 64;
const MID = 10;

/** A short line with the crow's foot marks the choice draws on the canvas (042). */
function Marks({ value }: { value: Cardinality }) {
  const left = crowPath({ x: 4, y: MID }, { x: 1, y: 0 }, endOf(value, 'from', undefined) ?? 'one');
  const right = crowPath(
    { x: WIDTH - 4, y: MID },
    { x: -1, y: 0 },
    endOf(value, 'to', undefined) ?? 'one',
  );
  return (
    <svg aria-hidden width={WIDTH} height={MID * 2} className="text-ink">
      <line x1={4} y1={MID} x2={WIDTH - 4} y2={MID} stroke="currentColor" strokeWidth={1.5} />
      <path d={left.d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path d={right.d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

/**
 * The four cardinalities as a radio group (052, frame 164). A radio is a button with the choice's
 * drawn marks and its text, so the choice is never colour or shape alone.
 */
export function CardinalityChoice({
  edge,
  onPick,
}: {
  edge: Edge;
  onPick: (value: Cardinality) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Cardinality"
      className="grid grid-cols-2 gap-2"
      onKeyDown={(event) => {
        const step =
          event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? -1
              : 0;
        if (step === 0) return;
        event.preventDefault();
        const at = edge.cardinality === undefined ? -1 : CHOICES.indexOf(edge.cardinality);
        const next = CHOICES[(at + step + CHOICES.length) % CHOICES.length];
        if (next !== undefined) onPick(next);
      }}
    >
      {CHOICES.map((value) => {
        const checked = edge.cardinality === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={cardinalityLabel(value)}
            tabIndex={checked || (edge.cardinality === undefined && value === '1-1') ? 0 : -1}
            onClick={() => {
              onPick(value);
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-1 rounded-card border border-border bg-surface px-2 py-2 text-caption text-ink hover:bg-surface-2',
              checked && 'border-primary bg-primary-soft text-primary-ink',
              focusRing,
            )}
          >
            <Marks value={value} />
            {cardinalityLabel(value)}
          </button>
        );
      })}
    </div>
  );
}
