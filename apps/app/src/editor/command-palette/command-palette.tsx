import { buildSearchIndex } from '@sododeck/model';
import { CommandDialog } from '@sododeck/ui/components/command-dialog';
import { useToast } from '@sododeck/ui/components/toast';
import { useReactFlow } from '@xyflow/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { useEditor } from '../../model/use-editor';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { useThemeStore } from '../../theme/theme-store';
import { canRunAction, runAction } from '../actions/actions-for';
import { ACTIONS } from '../actions/index';
import type { CanvasApi } from '../actions/types';
import { readActionContext } from '../actions/use-action-context';
import { openFlow } from '../flows/flow-mode';

import { buildCommands } from './commands';
import { openResult } from './open-result';
import { buildPaletteResults, type PaletteCommand } from './palette-results';
import { collapsedSchemaTables, groupTitleOf } from '../schema-groups';
import { firstViewShowing } from '../view-filter';
import { viewStateOf } from '../views/view-state';

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
  const openExport = useUiStore((state) => state.openExport);
  const closePalette = useUiStore((state) => state.closePalette);
  const announce = useUiStore((state) => state.announce);
  const select = useUiStore((state) => state.select);
  const focus = useUiStore((state) => state.focus);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [query, setQuery] = useState('');
  const { fitView, getZoom, setCenter, screenToFlowPosition, getViewport, getNodes, getEdges } =
    useReactFlow();
  const searchIndex = useMemo(() => buildSearchIndex(deck), [deck]);
  const hasSelection = useUiStore((s) => {
    const { nodes, edges, groups, stickies } = s.selection;
    return nodes.length + edges.length + groups.length + stickies.length > 0;
  });
  const jsonShown = useUiStore((s) => s.jsonShown);
  const codeOpen = useUiStore((s) => s.jsonPanel.codeDrawer.open);
  const { toast } = useToast();
  const commands = useMemo<readonly PaletteCommand[]>(() => {
    // Canvas actions offered as commands run exactly when their menu item would (019 FR-039).
    const canvasApi: CanvasApi = {
      fitView,
      screenToFlowPosition,
      getViewport,
      getNodes,
      getEdges,
    };
    const actionContext = () =>
      readActionContext(editor, canvasApi, (message) => {
        toast({ message });
      });
    const spreadEnds =
      screen === 'canvas' && canRunAction(ACTIONS, 'node.spreadEnds', actionContext())
        ? () => {
            runAction(ACTIONS, 'node.spreadEnds', actionContext());
          }
        : undefined;
    return buildCommands({
      navigate: (to) => {
        void navigate(to);
      },
      openRules: () => {
        openRules();
      },
      openExport: () => {
        openExport(null);
      },
      theme: { value: theme, resolved: theme, setTheme },
      focusModeAvailable: false,
      ...(screen === 'canvas'
        ? {
            shell: {
              canOpenDetails: hasSelection,
              openDetails: () => {
                useUiStore.getState().openDrawer();
              },
              jsonShown,
              toggleJson: () => {
                useUiStore.getState().toggleJsonShown();
              },
              codeOpen,
              toggleCode: () => {
                useUiStore.getState().toggleCodeDrawer();
              },
              hideUi: () => {
                useUiStore.getState().setHideUi(true);
              },
              ...(spreadEnds === undefined ? {} : { spreadEnds }),
            },
          }
        : {}),
    });
  }, [
    openExport,
    navigate,
    openRules,
    setTheme,
    theme,
    screen,
    hasSelection,
    jsonShown,
    codeOpen,
    editor,
    fitView,
    screenToFlowPosition,
    getViewport,
    getNodes,
    getEdges,
    toast,
  ]);
  const currentViewId = useUiStore((state) => state.currentViewId);
  const revealed = useUiStore((state) => state.revealed);
  const viewState = viewStateOf(deck, currentViewId, revealed);
  const hidden = viewState.hidden;
  const inSchema = collapsedSchemaTables(viewState.deck, viewState.collapsed);
  const inCollapsedSchema = useMemo(() => new Set(inSchema.keys()), [inSchema]);
  const results = useMemo(
    () => buildPaletteResults({ deck, searchIndex, query, commands, hidden, inCollapsedSchema }),
    [commands, deck, query, searchIndex, hidden, inCollapsedSchema],
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
          isHidden: (id) => hidden.has(id),
          collapsedSchemaOf: (id) => {
            const groupId = inSchema.get(id);
            const title = groupId === undefined ? undefined : groupTitleOf(deck, groupId);
            return groupId === undefined || title === undefined ? null : { groupId, title };
          },
          firstViewShowing: (id) => firstViewShowing(deck, viewState.views, id),
          showToast: (message, action) => {
            toast(action === undefined ? { message } : { message, action });
            announce(message);
            if (action === undefined) return;
            // Enter again runs the action: it takes focus once the palette has closed.
            requestAnimationFrame(() => {
              [...document.querySelectorAll<HTMLButtonElement>('button')]
                .find((button) => button.textContent === action.label)
                ?.focus();
            });
          },
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
