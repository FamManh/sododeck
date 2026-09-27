import { buildSearchIndex } from '@sododeck/model';
import { CommandDialog } from '@sododeck/ui/components/command-dialog';
import { useReactFlow } from '@xyflow/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { useEditor } from '../../model/use-editor';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { useThemeStore } from '../../theme/theme-store';
import { openFlow } from '../flows/flow-mode';
import { useExportDeck } from '../use-export-deck';

import { buildCommands } from './commands';
import { openResult } from './open-result';
import { buildPaletteResults, type PaletteCommand } from './palette-results';

function focusReturnTarget(target: HTMLElement | null): void {
  if (target?.isConnected !== true) return;
  globalThis.setTimeout(() => {
    if (target.isConnected) target.focus();
  }, 0);
}

function CommandPaletteSession({
  screen,
  openRules,
  navigateToCanvas,
  returnFocus,
}: {
  screen: 'canvas' | 'rules';
  openRules: (ruleId?: string) => void;
  navigateToCanvas: () => void;
  returnFocus: HTMLElement | null;
}) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const navigate = useNavigate();
  const exportDeck = useExportDeck();
  const closePalette = useUiStore((state) => state.closePalette);
  const announce = useUiStore((state) => state.announce);
  const select = useUiStore((state) => state.select);
  const focus = useUiStore((state) => state.focus);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [query, setQuery] = useState('');
  const { fitView, getZoom, setCenter } = useReactFlow();
  const searchIndex = useMemo(() => buildSearchIndex(deck), [deck]);
  const commands = useMemo<readonly PaletteCommand[]>(
    () =>
      buildCommands({
        navigate: (to) => {
          void navigate(to);
        },
        openRules: () => {
          openRules();
        },
        exportDeck,
        theme: { value: theme, resolved: theme, setTheme },
        focusModeAvailable: false,
      }),
    [exportDeck, navigate, openRules, setTheme, theme],
  );
  const results = useMemo(
    () => buildPaletteResults({ deck, searchIndex, query, commands }),
    [commands, deck, query, searchIndex],
  );

  const close = (restoreFocus: boolean) => {
    closePalette();
    if (restoreFocus) focusReturnTarget(returnFocus);
  };

  return (
    <CommandDialog
      open
      query={query}
      items={results.items}
      total={results.total}
      onQueryChange={setQuery}
      onOpenChange={(open) => {
        if (!open) close(true);
      }}
      onSelect={(item) => {
        const selected = results.items.find((entry) => entry.id === item.id);
        if (selected === undefined) return;
        const opened = openResult(selected, {
          editor,
          screen,
          announce,
          openRules,
          navigateToCanvas,
          fitView,
          setCenter,
          getZoom,
          select,
          focus,
          exitFlow: useUiStore.getState().exitFlow,
          openFlow,
        });
        if (!opened) return;
        close(selected.kind === 'command');
      }}
      emptyState={
        <div>
          <p>No results</p>
          <p>Try a different word.</p>
        </div>
      }
    />
  );
}

export function CommandPalette({
  screen,
  openRules,
  navigateToCanvas,
}: {
  screen: 'canvas' | 'rules';
  openRules: (ruleId?: string) => void;
  navigateToCanvas: () => void;
}) {
  const palette = useUiStore((state) => state.palette);
  if (!palette.open) return null;
  return (
    <CommandPaletteSession
      screen={screen}
      openRules={openRules}
      navigateToCanvas={navigateToCanvas}
      returnFocus={palette.returnFocus}
    />
  );
}
