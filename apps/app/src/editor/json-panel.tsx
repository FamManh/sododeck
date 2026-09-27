import { Button } from '@sododeck/ui/components/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { useUiStore } from '../state/ui-store';

const JsonEditor = lazy(() => import('./json-editor'));

/** Bottom JSON panel (DESIGN.md: 212px, collapsible to a 36px bar). */
export function JsonPanel({ json }: { json: string }) {
  const open = useUiStore((state) => state.jsonPanelOpen);
  const toggle = useUiStore((state) => state.toggleJsonPanel);

  return (
    <section
      aria-label="JSON"
      className="flex flex-col border-t border-hairline bg-surface"
      style={{ height: open ? 212 : 36 }}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 px-3">
        <h2 className="text-micro text-ink-muted uppercase">JSON</h2>
        <span className="font-mono text-caption text-ink-muted">read-only</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={open ? 'Collapse JSON panel' : 'Expand JSON panel'}
          aria-expanded={open}
          onClick={toggle}
        >
          {open ? <ChevronDown /> : <ChevronUp />}
        </Button>
      </div>
      {open && (
        <div className="min-h-0 flex-1 bg-code">
          <Suspense fallback={<p className="p-3 text-caption text-ink-muted">Loading editor…</p>}>
            <JsonEditor value={json} />
          </Suspense>
        </div>
      )}
    </section>
  );
}
