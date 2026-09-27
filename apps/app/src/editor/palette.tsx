import { KindTile } from '@sododeck/ui/components/kind-tile';
import { focusRing } from '@sododeck/ui/lib/focus';
import { COMPONENT_KINDS, KIND_STYLE, type ComponentKind } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { useReactFlow } from '@xyflow/react';

import { useEditor } from '../model/use-editor';
import { addComponent, canvasElement, centredOn, PALETTE_ID } from './canvas-actions';
import { KIND_MIME, NOTE_MIME } from './use-canvas-handlers';
import { addNoteAt, notesAreReadOnly } from './stickies/sticky-actions';

/** Palette order and hints (design 14). Cloud and partner kinds are deferred (§g-28 → B). */
const HINTS: Readonly<Record<ComponentKind, string>> = {
  service: 'API or worker',
  database: 'SQL, KV, TSDB',
  queue: 'Topic or stream',
  gateway: 'Ingress, auth',
  client: 'App or UI',
  external: 'Third party',
};

const ORDER: readonly ComponentKind[] = [
  'service',
  'database',
  'queue',
  'gateway',
  'client',
  'external',
];

/** Component kinds to add by click / Enter (centre of the view) or by dragging onto the canvas. */
export function Palette() {
  const editor = useEditor();
  const { screenToFlowPosition } = useReactFlow();
  const readOnly = notesAreReadOnly();

  const addAtCentre = (kind: ComponentKind) => {
    const rect = canvasElement()?.getBoundingClientRect();
    const centre = screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    });
    addComponent(editor, kind, centredOn(centre));
  };

  const centrePoint = () => {
    const rect = canvasElement()?.getBoundingClientRect();
    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    });
  };

  return (
    <section id={PALETTE_ID} aria-labelledby="palette-components" className="flex flex-col gap-2">
      <h3 id="palette-components" className="text-micro text-ink-muted uppercase">
        Components · drag or click
      </h3>
      <ul className="grid grid-cols-2 gap-2">
        {ORDER.filter((kind) => COMPONENT_KINDS.includes(kind)).map((kind) => (
          <li key={kind}>
            <button
              type="button"
              draggable
              aria-label={`Add ${KIND_STYLE[kind].label}`}
              onClick={() => {
                addAtCentre(kind);
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData(KIND_MIME, kind);
                event.dataTransfer.effectAllowed = 'copy';
              }}
              className={cn(
                'flex w-full cursor-grab flex-col items-start gap-2 rounded-card border border-hairline bg-surface p-3 text-left transition-colors hover:border-border hover:shadow-rest active:cursor-grabbing',
                focusRing,
              )}
            >
              <KindTile kind={kind} size={28} decorative />
              <span className="flex flex-col">
                <span className="text-body font-medium text-ink">{KIND_STYLE[kind].label}</span>
                <span className="text-caption text-ink-secondary">{HINTS[kind]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        draggable
        aria-label="Note"
        onClick={() => {
          if (readOnly) return;
          addNoteAt(editor, centrePoint());
        }}
        onDragStart={(event) => {
          if (readOnly) return;
          event.dataTransfer.setData(NOTE_MIME, 'note');
          event.dataTransfer.effectAllowed = 'copy';
        }}
        className={cn(
          'flex w-full cursor-grab items-start justify-between rounded-card border border-hairline bg-surface p-3 text-left transition-colors hover:border-border hover:shadow-rest active:cursor-grabbing',
          focusRing,
        )}
      >
        <span className="flex flex-col">
          <span className="text-body font-medium text-ink">Note</span>
          <span className="text-caption text-ink-secondary">Markdown, 180 px</span>
        </span>
      </button>
      <p className="text-caption text-ink-secondary">
        Drag Note onto a node to pin it, or onto empty canvas for a free note. N adds one at the
        pointer.
      </p>
    </section>
  );
}
