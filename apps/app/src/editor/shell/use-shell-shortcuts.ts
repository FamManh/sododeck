import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';

import { isTextTarget } from '../../lib/is-text-target';
import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { addComponent, canvasElement, centredOn, nodeElement } from '../canvas-actions';
import { PALETTE_SEARCH_ID } from '../palette';
import { focusSelectionToolbar, toolbarShown } from '../quick-edit/toolbar-focus';
import { useFitSelection } from './fit-selection';
import { isRegionId, nextRegion, visibleRegions, type RegionId } from './regions';
import { focusJsonOverlay } from './shell-focus';

const isMod = (event: KeyboardEvent) => event.metaKey || event.ctrlKey;

/** A modal dialog (command palette, confirmations) owns the keyboard while it is open. */
function inModal(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[role="dialog"][aria-modal="true"], [role="alertdialog"]') !== null
  );
}

function currentRegion(): RegionId | null {
  const element = document.activeElement?.closest('[data-region]');
  const region = element?.getAttribute('data-region') ?? undefined;
  return isRegionId(region) ? region : null;
}

/** Focuses a region's container (the canvas: its wrapper), so F6 shows the region ring. */
export function focusRegion(region: RegionId): void {
  if (region === 'canvas') {
    // Back to the card that holds the canvas's Tab stop, else the canvas itself.
    const id = useUiStore.getState().focusedId;
    (id === null ? null : nodeElement(id))?.focus();
    if (id === null || document.activeElement?.closest('[data-region="canvas"]') == null) {
      canvasElement()?.focus();
    }
    return;
  }
  document.querySelector<HTMLElement>(`[data-region="${region}"]`)?.focus();
}

/**
 * Keys of the canvas-first shell (018 R7, contract "Regions" and "Single-key guard"), installed
 * once by the canvas screen. Modified keys work everywhere, including text fields: F6 / ⇧F6
 * regions, ⌘\ Hide UI, ⌘J JSON, ⌘⇧D details, ⌥1 / ⌥2 Outline / Flows, ⌘E the selection toolbar
 * (019; not from a text field). Single keys work outside
 * text fields: ⇧1 / ⇧2 fit, M minimap, ? shortcuts, and outside flows V / S / L tools, C the
 * palette (with no card focused; the canvas keeps C for connecting a focused card, §g-49) and
 * 1–6 while the palette is open. Layout-dependent keys read `event.code`.
 */
export function useShellShortcuts(): void {
  const editor = useEditor();
  const { fitView, screenToFlowPosition } = useReactFlow();
  const fitSelection = useFitSelection();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || inModal(event.target)) return;
      const ui = useUiStore.getState();
      const handle = (action: () => void) => {
        event.preventDefault();
        action();
      };

      if (event.key === 'F6' && !isMod(event) && !event.altKey) {
        const visible = visibleRegions({ hideUi: ui.hideUi, drawerOpen: ui.drawer.open });
        handle(() => {
          focusRegion(nextRegion(currentRegion(), visible, event.shiftKey ? -1 : 1));
        });
        return;
      }
      if (isMod(event) && !event.altKey && event.code === 'Backslash') {
        handle(() => {
          ui.setHideUi(!ui.hideUi);
          ui.announce(ui.hideUi ? 'Interface shown' : 'Interface hidden');
        });
        return;
      }
      if (isMod(event) && !event.altKey && !event.shiftKey && event.code === 'KeyJ') {
        handle(() => {
          const show = !ui.jsonShown;
          ui.setJsonShown(show);
          ui.announce(show ? 'JSON shown' : 'JSON hidden');
          if (show) focusJsonOverlay();
          else canvasElement()?.focus();
        });
        return;
      }
      if (isMod(event) && event.shiftKey && !event.altKey && event.code === 'KeyD') {
        handle(() => {
          ui.toggleDrawer();
        });
        return;
      }
      // ⌘E: into the selection toolbar, when one is shown (019 FR-041); not from a text field.
      if (
        isMod(event) &&
        !event.shiftKey &&
        !event.altKey &&
        event.code === 'KeyE' &&
        !isTextTarget(event.target)
      ) {
        if (toolbarShown()) {
          handle(() => {
            focusSelectionToolbar();
          });
        }
        return;
      }
      if (event.altKey && !isMod(event) && !event.shiftKey) {
        const flyout =
          event.code === 'Digit1' ? 'outline' : event.code === 'Digit2' ? 'flows' : null;
        if (flyout !== null) {
          handle(() => {
            ui.openFlyout(flyout);
          });
        }
        return;
      }

      if (isMod(event) || event.altKey || isTextTarget(event.target)) return;

      if (event.shiftKey && (event.code === 'Digit1' || event.code === 'Digit2')) {
        handle(() => {
          if (event.code === 'Digit1') void fitView({ padding: 0.2 });
          else fitSelection();
        });
        return;
      }
      if (event.key === '?') {
        handle(() => {
          ui.setHelpOpen(true);
        });
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'm' && !event.shiftKey) {
        handle(() => {
          ui.setMinimap(!ui.minimap);
        });
        return;
      }

      // Editing keys: not in flow mode or during a recording (the canvas is view-only then).
      if (isFlowMode(ui) || ui.flowSession !== null || event.shiftKey) return;
      const tool =
        key === 'v'
          ? 'select'
          : key === 'h'
            ? 'hand'
            : key === 's'
              ? 'sticky'
              : key === 'l'
                ? 'connector'
                : null;
      if (tool !== null) {
        handle(() => {
          ui.setTool(tool);
        });
        return;
      }
      if (key === 'c') {
        handle(() => {
          ui.openFlyout('palette');
        });
        return;
      }
      if (key === '/' && ui.flyout === 'palette' && ui.addFlyout.view === 'types') {
        handle(() => {
          document.getElementById(PALETTE_SEARCH_ID)?.focus();
        });
        return;
      }
      const digit = /^Digit([1-9])$/.exec(event.code)?.[1];
      if (digit !== undefined && ui.flyout === 'palette') {
        // The n-th tile on screen: the tab and the search decide what that is (030).
        const kind = ui.addFlyout.visible[Number(digit) - 1];
        if (kind === undefined) return;
        handle(() => {
          const rect = canvasElement()?.getBoundingClientRect();
          const centre = screenToFlowPosition({
            x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
            y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
          });
          addComponent(editor, kind, centredOn(centre, kind), { edit: true });
          if (useUiStore.getState().pinnedFlyout !== 'palette') ui.closeFlyout();
        });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [editor, fitView, fitSelection, screenToFlowPosition]);
}
