import { C } from '../../../lib/landing/tokens';

/** A segmented control (drawn, not interactive): the code pane's tabs. */
export function Segmented({ items, active }: { items: readonly string[]; active: number }) {
  return (
    <div
      style={{
        display: 'flex',
        background: C.surface2,
        borderRadius: 9,
        padding: 2,
        gap: 2,
        flex: 'none',
      }}
    >
      {items.map((item, i) => (
        <span
          key={item}
          style={{
            height: 26,
            padding: '0 10px',
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            fontSize: 12,
            whiteSpace: 'nowrap',
            ...(i === active
              ? {
                  background: C.surface,
                  boxShadow: `0 1px 2px ${C.shadow}`,
                  fontWeight: 500,
                  color: C.ink,
                }
              : { color: C.inkSecondary }),
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
