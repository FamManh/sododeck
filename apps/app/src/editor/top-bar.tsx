import { Button } from '@sododeck/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { ArrowLeft, Moon, Redo2, Search, Sun, Undo2 } from 'lucide-react';
import { Link } from 'react-router';
import { useRef } from 'react';

import { isApplePlatform } from '../lib/features';
import { useEditor, useHistory } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { useThemeStore } from '../theme/theme-store';
import { DeckName } from './deck-name';
import { useSaveControls } from './save-context';
import { SaveStatus } from './save-status';
import { Wordmark } from './wordmark';

function HistoryButtons() {
  const editor = useEditor();
  const { canUndo, canRedo } = useHistory();
  const apple = isApplePlatform();
  const announce = useUiStore((s) => s.announce);
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => {
              if (editor.undo()) announce('Undone');
            }}
          >
            <Undo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo · {apple ? '⌘Z' : 'Ctrl+Z'}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={() => {
              if (editor.redo()) announce('Redone');
            }}
          >
            <Redo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redo · {apple ? '⇧⌘Z' : 'Ctrl+Y'}</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * The rule editor's top bar (008). The canvas screen has no top bar since 018: its controls float
 * in islands (`editor/shell/`).
 */
export function TopBar({ deckName }: { deckName: string }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const hostOwnsTheme = useSaveControls().mode === 'host';
  const openPalette = useUiStore((state) => state.openPalette);
  const jumpRef = useRef<HTMLButtonElement>(null);
  const jumpShortcut = isApplePlatform() ? '⌘K' : 'Ctrl+K';

  return (
    <header className="flex items-center gap-4 border-b border-hairline bg-surface px-4">
      <Wordmark />
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1.5 text-body text-ink-muted"
      >
        <span>Local</span>
        <span aria-hidden>/</span>
        <DeckName name={deckName} />
        <span aria-hidden>/</span>
        <span aria-current="page" className="text-ink">
          Rules
        </span>
      </nav>
      <HistoryButtons />
      <div className="flex-1" />
      <SaveStatus />
      <Button
        ref={jumpRef}
        variant="ghost"
        aria-label={`Jump to… (${jumpShortcut})`}
        aria-haspopup="dialog"
        className="gap-2 rounded-input bg-surface-2 px-2.5 text-ink-secondary hover:bg-surface-2"
        onClick={() => {
          openPalette(jumpRef.current);
        }}
      >
        <Search />
        <span className="text-body">Jump to…</span>
        <kbd aria-hidden className="font-sans text-caption text-ink-secondary">
          {jumpShortcut}
        </kbd>
      </Button>
      {hostOwnsTheme ? null : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Switch to ${nextTheme} theme`}
              onClick={() => {
                setTheme(nextTheme);
              }}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Switch to {nextTheme} theme</TooltipContent>
        </Tooltip>
      )}
      <Button asChild variant="primary">
        <Link to=".">
          <ArrowLeft />
          Back to canvas
        </Link>
      </Button>
    </header>
  );
}
