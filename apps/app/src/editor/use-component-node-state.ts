/**
 * The UI state a component node reads (card `deck-node.tsx`, shape `shapes/shape-node.tsx`):
 * connection role, end-drag target, resize, title edit and a refused connection's reason.
 */
import { useEffect } from 'react';

import { readDeck } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { isFlowMode, useUiStore } from '../state/ui-store';
import { connectionCheck, REFUSAL_TEXT, type ConnectionCheck } from './connection-rules';
import { useConnecting, useConnectionRole } from './use-connection-role';

export function useComponentNodeState(id: string, selected: boolean) {
  const editor = useEditor();
  const openConnectPopover = useUiStore((s) => s.openConnectPopover);
  const announce = useUiStore((s) => s.announce);
  const connecting = useConnecting();
  const role = useConnectionRole(id);
  // A connector end dragged over this card (017 R12, 050 R3): its four side targets show as
  // rings, with the side the end attaches to "hot" (filled and larger); none in the centre zone.
  // A primitive per node: selecting the whole gesture re-rendered every card on each pan / zoom.
  const hotSide = useUiStore((s) =>
    s.canvasGesture === 'endpoint' &&
    s.endpointPreview?.targetId === id &&
    s.endpointPreview.targetKind === 'node' &&
    !s.endpointPreview.automatic
      ? s.endpointPreview.side
      : null,
  );
  // Resizing (017 R4): pointer only, and only the single selected node, never in flow mode,
  // recording, view-only or inside a collapsed group (those never render a component at all).
  const resizable = useUiStore(
    (s) =>
      selected &&
      !isFlowMode(s) &&
      s.flowSession === null &&
      s.selection.nodes.length === 1 &&
      s.selection.edges.length === 0 &&
      s.selection.groups.length === 0 &&
      s.selection.stickies.length === 0,
  );
  // Only this node re-renders when its title edit starts or ends (the others select `null`).
  const titleEdit = useUiStore((s) =>
    s.titleEdit?.target === 'node' && s.titleEdit.id === id ? s.titleEdit : null,
  );

  let target: ConnectionCheck | null = null;
  if (role?.startsWith('target:')) {
    target = connectionCheck(readDeck(editor.doc), role.slice('target:'.length), id);
  }
  const refusal = target === null || target === 'ok' ? null : REFUSAL_TEXT[target];

  useEffect(() => {
    if (refusal) announce(refusal);
  }, [refusal, announce]);

  return {
    editor,
    announce,
    openConnectPopover,
    connecting,
    role,
    hotSide,
    resizable,
    titleEdit,
    target,
    refusal,
  };
}
