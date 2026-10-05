import { useToast } from '@sododeck/ui/components/toast';
import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

import { addImages } from '../../images/add-images';
import { useImagePorts } from '../../images/image-ports';
import { usePictureStore } from '../../images/picture-store';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { canvasElement } from '../canvas-actions';
import { useUndoToast } from '../undo-toast';

const FALLBACK_WIDTH = 1000;

/**
 * Adds picture files to the canvas (paste, drop, the Add flyout): where they land, what is
 * selected and what is said. `at` is a canvas point; without it the visible centre is used. Each
 * refusal gets its own toast, the success one carries Undo, and all of it is announced politely.
 */
export function useAddImages(): (files: readonly File[], at?: { x: number; y: number }) => void {
  const editor = useEditor();
  const store = usePictureStore();
  const ports = useImagePorts();
  const { screenToFlowPosition, getZoom } = useReactFlow();
  const { toast } = useToast();
  const undoToast = useUndoToast();

  return useCallback(
    (files, at) => {
      if (files.length === 0) return;
      const rect = canvasElement()?.getBoundingClientRect();
      const centre = screenToFlowPosition({
        x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
        y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
      });
      const zoom = getZoom();
      const viewportWidth =
        rect === undefined || rect.width === 0 ? FALLBACK_WIDTH : rect.width / (zoom || 1);
      void addImages({ editor, store, ports, at: at ?? centre, viewportWidth }, files).then(
        (result) => {
          const ui = useUiStore.getState();
          if (result.ids.length > 0) {
            ui.select({ images: result.ids });
            ui.focus(null);
          }
          const added = result.ids.length > 0 ? result.messages.at(-1) : undefined;
          // The Undo toast first: it replaces the previous Undo toast, so it must not dismiss ours.
          if (added !== undefined) undoToast(added);
          for (const message of result.messages) {
            if (message !== added) toast({ message });
          }
          ui.announce(result.messages.join(' '));
        },
      );
    },
    [editor, store, ports, screenToFlowPosition, getZoom, toast, undoToast],
  );
}
