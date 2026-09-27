import { Button } from '@sododeck/ui/components/button';
import { SearchField } from '@sododeck/ui/components/search-field';
import { X } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';

export const FLOW_FILTER_ID = 'flow-filter';

/** "Filter flows" (FR-034, FR-035): / focuses it, Esc clears it, "n of m" while filtering. */
export function FlowFilter({ count, total }: { count: number; total: number }) {
  const text = useUiStore((s) => s.flowFilter);
  const setText = useUiStore((s) => s.setFlowFilter);
  const filtering = text.trim() !== '';

  return (
    <div className="flex items-center gap-2">
      <SearchField
        id={FLOW_FILTER_ID}
        label="Filter flows"
        shortcut={filtering ? undefined : '/'}
        placeholder="Filter flows"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onClear={() => {
          setText('');
        }}
      />
      {filtering && (
        <>
          <span
            role="status"
            className="shrink-0 text-caption whitespace-nowrap text-ink-secondary"
          >
            {count} of {total}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear filter text"
            onClick={() => {
              setText('');
              document.getElementById(FLOW_FILTER_ID)?.focus();
            }}
          >
            <X />
          </Button>
        </>
      )}
    </div>
  );
}
