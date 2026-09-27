import { buildSearchIndex } from '@sododeck/model';
import { CommandDialog } from '@sododeck/ui/components/command-dialog';
import { useReactFlow } from '@xyflow/react';
import { useMemo, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { openFlow } from '../flows/flow-mode';

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
  commands,
}: {
  screen: 'canvas' | 'rules';
  openRules: (ruleId?: string) => void;
  navigateToCanvas: () => void;
  returnFocus: HTMLElement | null;
  commands: readonly PaletteCommand[];
}) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const closePalette = useUiStore((state) => state.closePalette);
  const announce = useUiStore((state) => state.announce);
  const select = useUiStore((state) => state.select);
  const focus = useUiStore((state) => state.focus);
  const [query, setQuery] = useState('');
  const { fitView, getZoom, setCenter } = useReactFlow();
  const searchIndex = useMemo(() => buildSearchIndex(deck), [deck]);
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
  commands = [],
}: {
  screen: 'canvas' | 'rules';
  openRules: (ruleId?: string) => void;
  navigateToCanvas: () => void;
  commands?: readonly PaletteCommand[];
}) {
  const palette = useUiStore((state) => state.palette);
  if (!palette.open) return null;
  return (
    <CommandPaletteSession
      screen={screen}
      openRules={openRules}
      navigateToCanvas={navigateToCanvas}
      returnFocus={palette.returnFocus}
      commands={commands}
    />
  );
}
