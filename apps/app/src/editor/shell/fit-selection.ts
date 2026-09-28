import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

import { useUiStore } from '../../state/ui-store';
import { GROUP_NODE_PREFIX } from '../deck-to-flow';

/** Fits the selected components (⇧2); nothing when nothing is selected. */
export function useFitSelection(): () => void {
  const { fitView } = useReactFlow();
  return useCallback(() => {
    const { nodes, groups } = useUiStore.getState().selection;
    const ids = [...nodes, ...groups.map((id) => `${GROUP_NODE_PREFIX}${id}`)];
    if (ids.length === 0) return;
    void fitView({ nodes: ids.map((id) => ({ id })), padding: 0.2 });
  }, [fitView]);
}
