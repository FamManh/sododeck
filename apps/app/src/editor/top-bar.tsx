import { Button } from '@sododeck/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { Download, Moon, Redo2, Sun, Undo2 } from 'lucide-react';

import { isApplePlatform } from '../lib/features';
import { useEditor, useHistory } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { useThemeStore } from '../theme/theme-store';
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

export function TopBar({ deckName }: { deckName: string }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="flex items-center gap-4 border-b border-hairline bg-surface px-4">
      <Wordmark />
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1.5 text-body text-ink-muted"
      >
        <span>Local</span>
        <span aria-hidden>/</span>
        <span className="truncate text-ink">{deckName}</span>
      </nav>
      <HistoryButtons />
      <div className="flex-1" />
      {/* TODO(M1): real autosave status ("Saving…" → "Saved in this browser"), feature 005. */}
      <span className="text-caption text-ink-muted">Demo · not saved</span>
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
      <Button variant="primary" disabled>
        <Download />
        Export
      </Button>
    </header>
  );
}
