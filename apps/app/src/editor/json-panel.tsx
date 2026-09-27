import { Button } from '@sododeck/ui/components/button';
import { Braces, ChevronUp } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { JsonPanelHeader } from './json-panel-header';
import { countLines } from './json-panel-view';
import { PANEL_COLLAPSED } from './panel-height';
import { useThrottledDeckText } from './use-throttled-deck-text';

const JsonViewer = lazy(() => import('./json-viewer'));

/**
 * Bottom JSON panel (004): a read-only view of the deck that is always in sync. It reads the
 * snapshot and gets every text from `@sododeck/model`; its only writes are deck undo/redo.
 */
export function JsonPanel() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const { open, height, tab } = useUiStore((state) => state.jsonPanel);
  const setJsonTab = useUiStore((state) => state.setJsonTab);
  const setJsonPanelOpen = useUiStore((state) => state.setJsonPanelOpen);

  const deckText = useThrottledDeckText(deck, open && tab === 'deck');
  const text = deckText;

  if (!open) {
    return (
      <section
        aria-label="JSON"
        className="flex shrink-0 items-center gap-2 border-t border-hairline bg-surface pr-2 pl-4"
        style={{ height: PANEL_COLLAPSED }}
      >
        <h2 className="flex items-center gap-2 text-body-sm text-ink-secondary">
          <Braces aria-hidden className="size-4" />
          JSON
        </h2>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Expand JSON panel"
          aria-expanded={false}
          onClick={() => {
            setJsonPanelOpen(true);
          }}
        >
          <ChevronUp />
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-label="JSON"
      className="flex shrink-0 flex-col border-t border-hairline bg-surface"
      style={{ height }}
    >
      <JsonPanelHeader
        tab={tab}
        onTabChange={setJsonTab}
        selectionLabel="Selection"
        selectionFullLabel="Selection"
        lineCount={countLines(text)}
        onCollapse={() => {
          setJsonPanelOpen(false);
        }}
      />
      <div className="min-h-0 flex-1 bg-code">
        <Suspense fallback={<p className="p-3 text-caption text-ink-muted">Loading editor…</p>}>
          <JsonViewer
            tab={tab}
            text={text}
            ariaLabel="Deck JSON, read-only"
            onReadOnlyAttempt={() => undefined}
            onUndo={() => {
              editor.undo();
            }}
            onRedo={() => {
              editor.redo();
            }}
          />
        </Suspense>
      </div>
    </section>
  );
}
