import type { SododeckFile } from '@sododeck/schema';
import { memo, useEffect, useMemo, type RefObject } from 'react';

import { useUiStore } from '../../state/ui-store';
import { focusSet } from '../focus-set';
import { hoverFocusCss } from './hover-focus-css';
import type { VisibleGraph } from '../visible-graph';

interface HoverFocusStyleProps {
  deck: SododeckFile;
  graph: VisibleGraph;
  /** The canvas wrapper: carries `data-hover-focus` while a hover shows, set without a render. */
  wrapper: RefObject<HTMLElement | null>;
}

/**
 * Hover focus, drawn as one generated `<style>` (034 R1). It subscribes to `hoverFocus` itself, so
 * the canvas does not render on a hover and no React Flow object changes.
 */
export const HoverFocusStyle = memo(function HoverFocusStyle({
  deck,
  graph,
  wrapper,
}: HoverFocusStyleProps) {
  const hoverId = useUiStore((s) => s.hoverFocus?.id ?? null);
  const set = useMemo(
    () => (hoverId === null ? null : focusSet(deck, graph, hoverId)),
    [hoverId, deck, graph],
  );
  const css = useMemo(() => (set === null ? null : hoverFocusCss(set)), [set]);
  const active = css !== null;

  useEffect(() => {
    const root = wrapper.current;
    if (root === null) return undefined;
    if (active) root.setAttribute('data-hover-focus', '');
    else root.removeAttribute('data-hover-focus');
    return () => {
      root.removeAttribute('data-hover-focus');
    };
  }, [active, wrapper]);

  return css === null ? null : <style>{css}</style>;
});
