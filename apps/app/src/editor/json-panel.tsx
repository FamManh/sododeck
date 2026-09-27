import { Button } from '@sododeck/ui/components/button';
import { Braces, ChevronUp } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { createCooldown } from './cooldown';
import { JsonPanelHeader } from './json-panel-header';
import { selectionText, selectionView } from './json-panel-view';
import { PANEL_COLLAPSED } from './panel-height';
import { useThrottledDeckText } from './use-throttled-deck-text';

const JsonViewer = lazy(() => import('./json-viewer'));

const READ_ONLY_MESSAGE = 'Read-only. Edit on the canvas or in the inspector.';
/** Refused edits are announced at most this often, so screen readers are not flooded. */
const READ_ONLY_COOLDOWN_MS = 3000;

/**
 * Bottom JSON panel (004): a read-only view of the deck that is always in sync. It reads the
 * snapshot and gets every text from `@sododeck/model`; its only writes are deck undo/redo.
 */
export function JsonPanel() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const { open, height, tab } = useUiStore((state) => state.jsonPanel);
  const selection = useUiStore((state) => state.selection);
  const setJsonTab = useUiStore((state) => state.setJsonTab);
  const setJsonPanelOpen = useUiStore((state) => state.setJsonPanelOpen);
  const announce = useUiStore((state) => state.announce);
  const readOnlyCooldown = useMemo(() => createCooldown(READ_ONLY_COOLDOWN_MS), []);

  const deckText = useThrottledDeckText(deck, open && tab === 'deck');
  // The label follows the selection even on the Deck tab; the text is built only when shown.
  const view = useMemo(() => selectionView(deck, selection), [deck, selection]);
  const showSelection = open && tab === 'selection';
  const text = showSelection ? selectionText(view.entries) : tab === 'deck' ? deckText : '';
  const empty = tab === 'selection' && view.entries.length === 0;

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
        view={view}
        text={text}
        onCollapse={() => {
          setJsonPanelOpen(false);
        }}
      />
      <div className="min-h-0 flex-1 bg-code">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="text-body-sm text-ink-secondary">
              Select a component or connection to see its JSON.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setJsonTab('deck');
              }}
            >
              Show Deck JSON
            </Button>
          </div>
        ) : (
          <Suspense fallback={<p className="p-3 text-caption text-ink-muted">Loading editor…</p>}>
            <JsonViewer
              tab={tab}
              text={text}
              ariaLabel={tab === 'deck' ? 'Deck JSON, read-only' : 'Selection JSON, read-only'}
              onReadOnlyAttempt={() => {
                if (readOnlyCooldown()) announce(READ_ONLY_MESSAGE);
              }}
              onUndo={() => {
                editor.undo();
              }}
              onRedo={() => {
                editor.redo();
              }}
            />
          </Suspense>
        )}
      </div>
    </section>
  );
}
