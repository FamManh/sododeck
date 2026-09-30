import type { Edge, SododeckFile, Side } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Input } from '@sododeck/ui/components/input';
import { PanelSection } from '@sododeck/ui/components/panel';
import { useId, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { cardBox } from '../canvas-geometry';
import { oneStep } from '../fields/one-step';
import { PickField } from '../fields/pick-field';
import { middleSegment, resolveSides } from '../routing/route-path';

const AUTO = 'auto';

const SIDE_OPTIONS = [
  { value: AUTO, label: 'Auto' },
  { value: 'top', label: 'Top' },
  { value: 'right', label: 'Right' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
] as const;

/**
 * The connection's route as controls (017 R12, FR-013/FR-014): "From side" / "To side" pin an
 * end (Auto lets it follow the geometry again), and "Offset" moves the middle segment when the
 * resolved sides are opposite each other. "Reset route" clears the whole route in one step.
 */
export function RouteFields({ deck, edge }: { deck: SododeckFile; edge: Edge }) {
  const editor = useEditor();
  const id = useId();
  const editable = useUiStore((s) => !isFlowMode(s) && s.flowSession === null);
  const fromIndex = deck.nodes.findIndex((n) => n.id === edge.from);
  const toIndex = deck.nodes.findIndex((n) => n.id === edge.to);
  const fromNode = deck.nodes[fromIndex];
  const toNode = deck.nodes[toIndex];
  if (fromNode === undefined || toNode === undefined) return null;

  const fromBox = cardBox(fromNode, fromIndex, 'component');
  const toBox = cardBox(toNode, toIndex, 'component');
  const sides = resolveSides(fromBox, toBox, edge.route);
  const hasSegment = middleSegment(sides) !== null;
  const offset = edge.route?.offset ?? 0;

  const setSide = (key: 'fromSide' | 'toSide', value: string) => {
    oneStep(editor, () => {
      editor.setEdgeRoute(edge.id, { [key]: value === AUTO ? null : (value as Side) });
    });
  };

  return (
    <PanelSection label="Route">
      <div className="grid grid-cols-2 gap-3">
        <PickField
          label="From side"
          listLabel="Sides"
          value={edge.route?.fromSide ?? AUTO}
          options={SIDE_OPTIONS}
          disabled={!editable}
          onPick={(value) => {
            setSide('fromSide', value);
          }}
        />
        <PickField
          label="To side"
          listLabel="Sides"
          value={edge.route?.toSide ?? AUTO}
          options={SIDE_OPTIONS}
          disabled={!editable}
          onPick={(value) => {
            setSide('toSide', value);
          }}
        />
      </div>
      <div className="flex items-end gap-2">
        <OffsetField
          id={`${id}-offset`}
          value={offset}
          disabled={!editable || !hasSegment}
          hint={hasSegment ? undefined : 'No middle segment for these sides'}
          onCommit={(value) => {
            oneStep(editor, () => {
              editor.setEdgeRoute(edge.id, { offset: value });
            });
          }}
        />
        <Button
          variant="ghost"
          disabled={!editable || edge.route === undefined}
          onClick={() => {
            oneStep(editor, () => {
              editor.setEdgeRoute(edge.id, null);
            });
            useUiStore.getState().announce('Route reset');
          }}
        >
          Reset route
        </Button>
      </div>
    </PanelSection>
  );
}

function OffsetField({
  id,
  value,
  disabled,
  hint,
  onCommit,
}: {
  id: string;
  value: number;
  disabled: boolean;
  hint?: string;
  onCommit: (value: number) => void;
}) {
  // The draft is the only copy while typing; the document changes on commit.
  const [draft, setDraft] = useState<string | null>(null);
  const done = () => {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (draft.trim() !== '' && Number.isFinite(next) && Math.round(next) !== value) {
      onCommit(Math.round(next));
    }
  };
  const hintId = hint === undefined ? undefined : `${id}-hint`;
  return (
    <div className="flex flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-caption text-ink-secondary">
        Offset
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        disabled={disabled}
        aria-describedby={hintId}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={done}
        onKeyDown={(event) => {
          if (event.key === 'Enter') done();
          if (event.key === 'Escape' && draft !== null) {
            event.stopPropagation();
            setDraft(null);
          }
        }}
      />
      {hint !== undefined && (
        <span id={hintId} className="text-caption text-ink-secondary">
          {hint}
        </span>
      )}
    </div>
  );
}
