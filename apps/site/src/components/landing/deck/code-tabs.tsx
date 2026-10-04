interface CodeTabsProps {
  id: string;
  items: readonly string[];
  active: number;
}

/**
 * The code panel's tabs as a real tablist (WAI-ARIA tabs, manual activation): drawn like the
 * segmented control, switched by `landing-controls.ts` (click, ← / →, Home / End).
 */
export function CodeTabs({ id, items, active }: CodeTabsProps) {
  return (
    <div role="tablist" aria-label="Code format" className="ld-tabs">
      {items.map((item, i) => (
        <button
          key={item}
          type="button"
          role="tab"
          id={`${id}-tab-${String(i)}`}
          aria-controls={`${id}-panel-${String(i)}`}
          aria-selected={i === active}
          tabIndex={i === active ? 0 : -1}
          className="ld-tab"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
