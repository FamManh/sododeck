import type { SododeckFile } from '@sododeck/schema';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

import { isTextTarget } from '../../lib/is-text-target';
import { hasDetailsTarget, useUiStore } from '../../state/ui-store';
import { canvasElement } from '../canvas-actions';
import { Inspector } from '../inspector';
import { DeckInspector } from '../inspector/deck-inspector';
import { EnumInspector } from '../inspector/enum/enum-inspector';
import { DrawerCloseContext } from './drawer-close-context';
import { DrawerGrip } from './drawer-grip';
import { clampDrawerWidth, EDGE, panToClear } from './shell-geometry';

/** Where focus lands when the drawer opens: the title, else the first field or control. */
const TITLE_FIELD = 'input[aria-label="Title"]';
const FIRST_FIELD = 'input:not([disabled]), textarea, button:not([disabled]), [tabindex="0"]';

/** The canvas element of a node by id, for its on-screen rectangle (React Flow sets `data-id`). */
function nodeElement(id: string): Element | null {
  return document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
}

/**
 * The details drawer (018 FR-021–FR-027, contract "Detail drawer"): the inspector on request,
 * over the right side of the canvas, which never resizes. Opening it moves focus to the first
 * field (the title) and pans the canvas horizontally when it would cover the selection; Esc or
 * "Close details" closes it and gives focus back to the canvas object. `deck` mode shows the deck
 * (Deck settings) whatever is selected.
 */
export function DetailDrawer({
  deck,
  compact = false,
  onOpenRules,
}: {
  deck: SododeckFile;
  compact?: boolean;
  onOpenRules?: () => void;
}) {
  const drawer = useUiStore((s) => s.drawer);
  const announce = useUiStore((s) => s.announce);
  const { getViewport, setViewport } = useReactFlow();
  const ref = useRef<HTMLElement>(null);
  const width = clampDrawerWidth(
    drawer.width,
    typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth,
    compact,
  );

  // The enum drawer closes when its enum is removed (undo, another tab) (052 FR-005).
  const enumGone = drawer.open && !hasDetailsTarget({ ...useUiStore.getState(), drawer }, deck);

  const close = useCallback(() => {
    const ui = useUiStore.getState();
    const back = ui.drawerReturn;
    ui.closeDrawer();
    announce('Details closed');
    if (back !== null) ui.focus(back);
    canvasElement()?.focus();
  }, [announce]);

  // On open: focus the first field, and keep the selection visible (pan only, never zoom).
  useEffect(() => {
    if (!drawer.open) return;
    announce('Details opened');
    const frame = requestAnimationFrame(() => {
      const drawer = ref.current;
      (
        drawer?.querySelector<HTMLElement>(TITLE_FIELD) ??
        drawer?.querySelector<HTMLElement>(FIRST_FIELD)
      )?.focus();
      const [nodeId] = useUiStore.getState().selection.nodes;
      const element = nodeId === undefined ? null : nodeElement(nodeId);
      const drawerLeft = ref.current?.getBoundingClientRect().left;
      if (element === null || drawerLeft === undefined || drawerLeft === 0) return;
      const rect = element.getBoundingClientRect();
      const dx = panToClear(
        { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        { right: drawerLeft },
      );
      if (dx === 0) return;
      const viewport = getViewport();
      void setViewport({ ...viewport, x: viewport.x + dx });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
    // Only when the drawer opens, not on every width change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.open]);

  useEffect(() => {
    if (enumGone && drawer.mode === 'enum') close();
  }, [enumGone, drawer.mode, close]);

  if (!drawer.open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || isTextTarget(event.target)) return;
    if (event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  return (
    <aside
      ref={ref}
      aria-label="Details"
      data-region="drawer"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onKeyDownCapture={(event) => {
        // In a field, Esc is the field's (it reverts and stops the event); once it is done,
        // focus leaves the field, and the next Esc closes the drawer.
        if (event.key !== 'Escape' || !isTextTarget(event.target)) return;
        queueMicrotask(() => {
          ref.current?.focus();
        });
      }}
      style={{ width, right: EDGE }}
      className="sd-overlay-in-right pointer-events-auto absolute top-17 bottom-3 flex flex-col rounded-card border border-hairline bg-surface shadow-float outline-none"
    >
      <DrawerGrip width={width} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
        <DrawerCloseContext value={close}>
          {drawer.mode === 'deck' ? (
            <DeckInspector deck={deck} {...(onOpenRules === undefined ? {} : { onOpenRules })} />
          ) : drawer.mode === 'enum' ? (
            <EnumInspector deck={deck} enumId={drawer.enumId} />
          ) : (
            <Inspector deck={deck} {...(onOpenRules === undefined ? {} : { onOpenRules })} />
          )}
        </DrawerCloseContext>
      </div>
    </aside>
  );
}
