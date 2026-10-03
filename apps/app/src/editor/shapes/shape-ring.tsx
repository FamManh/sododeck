import type { Box } from './shape-geometry';

/**
 * State rings follow the geometry at a true offset (DESIGN.md States, Shape column): a band from
 * `offset` to `offset + width` outside the outline, cut from a wide stroke by a mask that hides a
 * narrower one and the inside. Selected sits 4 px out; a problem 7 px out so both show together.
 */
const RINGS = {
  selected: { offset: 4, width: 2 },
  problem: { offset: 7, width: 1.5 },
} as const;
type RingKind = keyof typeof RINGS;

export function Ring({
  kind,
  d,
  maskId,
  box,
  className,
  testId,
}: {
  kind: RingKind;
  d: string;
  maskId: string;
  box: Box;
  className: string;
  testId?: string;
}) {
  const { offset, width } = RINGS[kind];
  const pad = offset + width + 4;
  const id = `${maskId}-${kind}`;
  return (
    <>
      <mask
        id={id}
        maskUnits="userSpaceOnUse"
        x={box.x - pad}
        y={box.y - pad}
        width={box.width + 2 * pad}
        height={box.height + 2 * pad}
      >
        <path
          d={d}
          fill="none"
          stroke="white"
          strokeWidth={2 * (offset + width)}
          strokeLinejoin="round"
        />
        <path d={d} fill="black" stroke="black" strokeWidth={2 * offset} strokeLinejoin="round" />
      </mask>
      <path
        data-testid={testId}
        className={className}
        d={d}
        mask={`url(#${id})`}
        style={{ strokeWidth: 2 * (offset + width) }}
      />
    </>
  );
}
