import { Button } from '@sododeck/ui/components/button';
import { InlineEdit } from '@sododeck/ui/components/inline-edit';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { ArrowLeft, Download, Moon, Redo2, Search, Sun, Table2, Undo2 } from 'lucide-react';
import { Link } from 'react-router';
import { useRef, useState } from 'react';

import { isApplePlatform } from '../lib/features';
import { useEditor, useHistory } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { useThemeStore } from '../theme/theme-store';
import { SessionChip } from './flows/session-chip';
import { DrillCrumbs, type DrillDeck } from './drill-crumbs';
import { SaveStatus } from './save-status';
import { useExportDeck } from './use-export-deck';
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
 * The deck name in the breadcrumb: a button "Rename deck" that turns into a field (FR-017).
 * Enter saves through the editor (one undo step), Esc cancels, an empty name keeps the old one.
 */
function DeckNameCrumb({ name }: { name: string }) {
  const editor = useEditor();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <InlineEdit
        label="Deck name"
        value={name}
        autoFocus
        className="w-56 text-ink"
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        onCommit={(next) => {
          const trimmed = next.trim();
          if (trimmed !== '' && trimmed !== name) editor.updateMeta({ name: trimmed });
        }}
        onKeyDown={(event) => {
          // InlineEdit commits on Enter itself; leaving edit mode is ours.
          if (event.key === 'Enter') setEditing(false);
        }}
        onBlur={() => {
          setEditing(false);
        }}
      />
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Rename deck"
      title={name}
      className="max-w-72 min-w-0 px-1.5 font-normal text-ink"
      onClick={() => {
        setEditing(true);
      }}
    >
      <span className="truncate">{name}</span>
    </Button>
  );
}

export function TopBar({
  deckName,
  deck,
  screen = 'canvas',
  rulesCount = 0,
}: {
  deckName: string;
  deck?: DrillDeck;
  /** The rule editor adds "Rules" to the breadcrumb and "Back to canvas" replaces Export (008). */
  screen?: 'canvas' | 'rules';
  rulesCount?: number;
}) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const exportDeck = useExportDeck();
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
        <DeckNameCrumb name={deckName} />
        {screen === 'canvas' && deck !== undefined && <DrillCrumbs deck={deck} />}
        {screen === 'rules' && (
          <>
            <span aria-hidden>/</span>
            <span aria-current="page" className="text-ink">
              Rules
            </span>
          </>
        )}
      </nav>
      <HistoryButtons />
      {/* The flow session chip sits where the view switcher of 010/011 will go (FR-007). */}
      <div className="flex min-w-0 flex-1 justify-center">
        <SessionChip />
      </div>
      {screen === 'canvas' && (
        <Button asChild variant="ghost">
          <Link to="rules">
            <Table2 />
            Rules
            <span className="rounded-full bg-surface-2 px-1.5 text-caption text-ink-secondary">
              {rulesCount}
            </span>
          </Link>
        </Button>
      )}
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
      {screen === 'rules' ? (
        <Button asChild variant="primary">
          <Link to=".">
            <ArrowLeft />
            Back to canvas
          </Link>
        </Button>
      ) : (
        <Button variant="primary" onClick={exportDeck}>
          <Download />
          Export
        </Button>
      )}
    </header>
  );
}
