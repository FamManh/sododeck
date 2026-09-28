import type { KeyboardEvent } from 'react';

import { useUiStore } from '../../state/ui-store';
import { JsonPanel } from '../json-panel';
import { focusCanvas } from './shell-focus';
import { EDGE, FLYOUT_LEFT } from './shell-geometry';

/**
 * The JSON panel as a bottom overlay (018 FR-028–FR-031, design 93): hidden until ⌘J or the deck
 * menu, from the rail to the right edge or the drawer's left edge. The panel itself is 004's,
 * read-only (§g-42). Esc gives focus back to the canvas and leaves the overlay open.
 */
export function JsonOverlay({ drawerWidth }: { drawerWidth: number | null }) {
  const shown = useUiStore((s) => s.jsonShown);
  const setJsonShown = useUiStore((s) => s.setJsonShown);
  if (!shown) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    focusCanvas();
  };

  const right = drawerWidth === null ? EDGE : EDGE + drawerWidth + EDGE;
  return (
    // This box spans the free height and is the panel's parent, so the panel's height clamp
    // (004) measures it; only the panel itself takes pointer events.
    <div
      data-json-overlay
      className="pointer-events-none absolute top-17 bottom-3 flex flex-col justify-end"
      style={{ left: FLYOUT_LEFT, right }}
      onKeyDown={onKeyDown}
    >
      <JsonPanel
        className="sd-overlay-in-up pointer-events-auto overflow-hidden rounded-card border border-hairline shadow-float"
        onClose={() => {
          setJsonShown(false);
          focusCanvas();
        }}
      />
    </div>
  );
}
