import type { Id } from '@sododeck/schema';
import { useEffect, useRef } from 'react';

import { useUiStore, type Selection } from '../../state/ui-store';
import { cancelCrop } from './crop-commands';

/** Whether `selection` is exactly the one image `imageId`. */
function onlyImage(selection: Selection, imageId: Id): boolean {
  const { nodes, edges, groups, stickies, images } = selection;
  return (
    images.length === 1 &&
    images[0] === imageId &&
    nodes.length + edges.length + groups.length + stickies.length === 0
  );
}

/**
 * Ends crop mode on `imageId` without writing when it is interrupted (057 research R9): the
 * selection stops being exactly that image, the image becomes locked, or its node unmounts
 * (deleted, hidden in a collapsed group, out of drill scope). A deck switch and flow mode clear the
 * session in the store. Remote moves, resizes and flips keep it: confirm reads the latest box.
 */
export function useCropInterruptions(imageId: Id, locked: boolean): void {
  useEffect(() => {
    if (locked && useUiStore.getState().cropSession?.imageId === imageId) cancelCrop();
  }, [imageId, locked]);

  useEffect(
    () =>
      useUiStore.subscribe((state, previous) => {
        if (state.selection === previous.selection) return;
        if (state.cropSession?.imageId !== imageId) return;
        if (!onlyImage(state.selection, imageId)) cancelCrop();
      }),
    [imageId],
  );

  // Checked a microtask later, so a development double mount (unmount, mount) keeps the session.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current && useUiStore.getState().cropSession?.imageId === imageId)
          cancelCrop();
      });
    };
  }, [imageId]);
}
