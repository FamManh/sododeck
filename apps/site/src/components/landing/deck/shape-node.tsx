import type { ShapeData } from '../../../lib/landing/checkout-deck';
import { C, pal } from '../../../lib/landing/tokens';

/** The outline of a pill or a sticky note, inset by 4px so the 1.5px stroke stays inside. */
function outline(shape: ShapeData['shape'], w: number, h: number): string {
  const i = 4;
  if (shape === 'sticky') {
    return `M${String(i)} ${String(i)}H${String(w - i)}V${String(h - i - 16)}L${String(w - i - 16)} ${String(h - i)}H${String(i)}Z`;
  }
  const r = (h - 2 * i) / 2;
  return [
    `M${String(i + r)} ${String(i)}H${String(w - i - r)}`,
    `A${String(r)} ${String(r)} 0 0 1 ${String(w - i - r)} ${String(h - i)}`,
    `H${String(i + r)}`,
    `A${String(r)} ${String(r)} 0 0 1 ${String(i + r)} ${String(i)}Z`,
  ].join('');
}

/** A Deck shape (031): the pill end of a flow branch, or a sticky note. */
export function ShapeNode({ shape }: { shape: ShapeData }) {
  const { w, h } = shape;
  const sticky = shape.shape === 'sticky';
  const fill = sticky ? pal('yellow', 'chip') : C.surface;
  const stroke = sticky ? pal('yellow', 'stroke') : C.borderStrong;
  const d = outline(shape.shape, w, h);
  const inset = { x: w * (sticky ? 0.08 : 0.1) + 4, y: h * (sticky ? 0.08 : 0.1) };
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      <svg
        aria-hidden
        width={w}
        height={h}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
      >
        <path d={d} transform="translate(0 3)" fill={stroke} />
        <path d={d} fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
        {sticky && (
          <path
            d={`M${String(w - 4)} ${String(h - 20)}H${String(w - 20)}V${String(h - 4)}`}
            fill={stroke}
            fillOpacity={0.35}
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: inset.x,
          right: inset.x,
          top: inset.y,
          bottom: inset.y,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.3,
          color: C.ink,
          textAlign: 'center',
          textWrap: 'pretty',
        }}
      >
        {shape.title}
      </div>
    </div>
  );
}
