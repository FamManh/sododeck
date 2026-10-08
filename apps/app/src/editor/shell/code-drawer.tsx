import { Button } from '@sododeck/ui/components/button';
import { X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

import { isTextTarget } from '../../lib/is-text-target';
import { useUiStore } from '../../state/ui-store';
import { canvasElement } from '../canvas-actions';
import { CodeFormatTabs } from '../code/code-format-tabs';
import { DrawerGrip } from './drawer-grip';
import { CODE_DRAWER_MIN, EDGE } from './shell-geometry';
import { useDrawerWidths } from './use-drawer-widths';

// Loaded on first use, so the DBML parser and editor code stay off the main path (046 FR-006).
const DbmlTab = lazy(() => import('../code/dbml-tab').then((m) => ({ default: m.DbmlTab })));
const SqlTab = lazy(() => import('../code/sql-tab').then((m) => ({ default: m.SqlTab })));

/**
 * The code drawer (054): the deck's schema as DBML (editable) and SQL (read-only), on the right
 * like the details drawer and left of it when both are open. It always shows the whole schema.
 * Esc or Close gives focus back to what opened it; the grip is a keyboard-operable separator
 * like the details drawer's.
 */
export function CodeDrawer() {
  const open = useUiStore((s) => s.jsonPanel.codeDrawer.open);
  const format = useUiStore((s) => s.jsonPanel.codeDrawer.format);
  const setFormat = useUiStore((s) => s.setCodeDrawerFormat);
  const setWidth = useUiStore((s) => s.setCodeDrawerWidth);
  const closeCodeDrawer = useUiStore((s) => s.closeCodeDrawer);
  const announce = useUiStore((s) => s.announce);
  const { details, code, codeMax } = useDrawerWidths();
  const ref = useRef<HTMLElement>(null);
  /** What had focus when the drawer opened: the deck menu's button, a palette row, the canvas. */
  const opener = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    closeCodeDrawer();
    announce('Code closed');
  }, [closeCodeDrawer, announce]);

  // On open: remember the opener, then focus the selected tab (focus moves into the drawer).
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    announce('Code opened');
    const frame = requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the drawer opens, not on every tab change
  }, [open]);

  // However it closed (Esc, ×, the menu, a narrow window opening the details drawer), focus must
  // not fall to the page: back to the opener, else the canvas.
  const wasOpen = useRef(false);
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active !== null && active !== document.body && active.isConnected) return;
      const back = opener.current;
      if (back?.isConnected === true) back.focus();
      else canvasElement()?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open]);

  if (!open || code === null) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || isTextTarget(event.target) || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  return (
    <aside
      ref={ref}
      aria-label="Code"
      data-region="code"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onKeyDownCapture={(event) => {
        // In the editor, Esc is the editor's; once it is done focus leaves it and the next Esc
        // closes the drawer (the same rule as the details drawer).
        if (event.key !== 'Escape' || !isTextTarget(event.target)) return;
        queueMicrotask(() => {
          ref.current?.focus();
        });
      }}
      style={{ width: code, right: details === null ? EDGE : EDGE + details + EDGE }}
      className="sd-overlay-in-right pointer-events-auto absolute top-17 bottom-3 flex flex-col rounded-card border border-hairline bg-surface shadow-float outline-none"
    >
      <DrawerGrip
        width={code}
        min={CODE_DRAWER_MIN}
        max={codeMax}
        label="Resize code"
        onChange={(px) => {
          setWidth(px);
        }}
        onCommit={(px) => {
          setWidth(px, { commit: true });
        }}
      />
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-hairline pr-2 pl-4">
        <CodeFormatTabs format={format} onChange={setFormat} />
        <div className="flex-1" />
        <Button variant="ghost" size="icon-sm" aria-label="Close code" onClick={close}>
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-b-card bg-code">
        <Suspense fallback={<p className="p-3 text-caption text-ink-muted">Loading editor…</p>}>
          {format === 'dbml' ? <DbmlTab /> : <SqlTab />}
        </Suspense>
      </div>
    </aside>
  );
}
