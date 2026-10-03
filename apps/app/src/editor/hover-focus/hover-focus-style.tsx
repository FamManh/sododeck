import type { SododeckFile } from '@sododeck/schema';
import { memo, useEffect, useRef, type RefObject } from 'react';

import { useUiStore } from '../../state/ui-store';
import type { BundleResult } from '../bundles';
import { focusSet } from '../focus-set';
import type { VisibleGraph } from '../visible-graph';
import { hoverFocusCss } from './hover-focus-css';

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
    let style: HTMLStyleElement | null = null;
    const clear = () => {
      style?.remove();
      style = null;
      root.removeAttribute('data-hover-focus');
    };
    const run = () => {
      const id = useUiStore.getState().hoverFocus?.id ?? null;
      const current = inputs.current;
      const set = id === null ? null : focusSet(current.deck, current.graph, id, current.bundles);
      if (set === null) {
        clear();
        return;
      }
      style ??= root.appendChild(document.createElement('style'));
      style.textContent = hoverFocusCss(set);
      root.setAttribute('data-hover-focus', '');
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
