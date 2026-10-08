import type { SododeckFile } from '@sododeck/schema';
import { memo, useEffect, useRef, type RefObject } from 'react';

import { useUiStore } from '../../state/ui-store';
import type { BundleResult } from '../bundles';
import { columnFocusSet, focusSet, relationshipRows } from '../focus-set';
import type { VisibleGraph } from '../visible-graph';
import { hoverFocusCss, relationshipRowsCss } from './hover-focus-css';

interface HoverFocusStyleProps {
  deck: SododeckFile;
  graph: VisibleGraph;
  /** Folded bundles count as one connection when a card is lit (034 Story 2.3). */
  bundles?: BundleResult;
  /** The canvas wrapper: carries `data-hover-focus` and the generated `<style>` while a hover shows. */
  wrapper: RefObject<HTMLElement | null>;
}

/**
 * Hover focus, drawn as one generated `<style>` (034 R1). It listens to the store directly and
 * writes the stylesheet and the wrapper's `data-hover-focus` in the same task as the change, with
 * no React render: the 16 ms budget (SC-001) has no room for a scheduler turn, and no React Flow
 * object changes. Renders nothing itself.
 */
export const HoverFocusStyle = memo(function HoverFocusStyle({
  deck,
  graph,
  bundles,
  wrapper,
}: HoverFocusStyleProps) {
  const inputs = useRef({ deck, graph, bundles });
  const apply = useRef<(() => void) | null>(null);

  useEffect(() => {
    const root = wrapper.current;
    if (root === null) return undefined;
    // A constructed stylesheet, not a `<style>` element: hosts that load the page forbid
    // creating style elements. The selectors are all under the wrapper's data attributes.
    const doc = root.ownerDocument;
    let sheet: CSSStyleSheet | null = null;
    const clear = () => {
      const dropped = sheet;
      if (dropped !== null) {
        doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((other) => other !== dropped);
      }
      sheet = null;
      root.removeAttribute('data-hover-focus');
      root.removeAttribute('data-hover-rows');
    };
    const show = (text: string, attribute: 'data-hover-focus' | 'data-hover-rows') => {
      if (sheet === null) {
        sheet = new CSSStyleSheet();
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
      }
      sheet.replaceSync(text);
      root.removeAttribute(
        attribute === 'data-hover-focus' ? 'data-hover-rows' : 'data-hover-focus',
      );
      root.setAttribute(attribute, '');
    };
    /** Rows only, nothing dimmed: a hovered relationship, or a column in focus mode / a flow. */
    const showRows = (rows: ReadonlySet<string>, edges: Iterable<string>) => {
      const lines = relationshipRowsCss(rows, edges, '[data-hover-rows]');
      if (lines.length === 0) clear();
      else show(lines.join('\n'), 'data-hover-rows');
    };
    const run = () => {
      const ui = useUiStore.getState();
      const focus = ui.hoverFocus;
      const current = inputs.current;
      if (focus === null) {
        clear();
        return;
      }
      if (focus.source === 'edge') {
        showRows(relationshipRows(current.deck, focus.id), [focus.id]);
        return;
      }
      if (focus.source === 'column' && focus.column !== undefined) {
        const set = columnFocusSet(current.deck, focus.column.tableId, focus.column.columnId);
        if (set === undefined) clear();
        // Pinned focus and flows keep their look; the row highlight is added (FR-024).
        else if (ui.focusMode || ui.activeFlow !== null) showRows(set.rows ?? new Set(), set.edges);
        else show(hoverFocusCss(set), 'data-hover-focus');
        return;
      }
      const set = focusSet(current.deck, current.graph, focus.id, current.bundles);
      if (set === null) clear();
      else show(hoverFocusCss(set), 'data-hover-focus');
    };
    apply.current = run;
    run();
    const unsubscribe = useUiStore.subscribe((state, previous) => {
      if (state.hoverFocus !== previous.hoverFocus) run();
    });
    return () => {
      unsubscribe();
      apply.current = null;
      clear();
    };
  }, [wrapper]);

  // A new deck, scope or bundle set changes who the neighbours are while a hover is showing.
  useEffect(() => {
    inputs.current = { deck, graph, bundles };
    apply.current?.();
  }, [deck, graph, bundles]);

  return null;
});
