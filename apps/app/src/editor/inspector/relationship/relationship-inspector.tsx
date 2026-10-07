import { edgeShape } from '@sododeck/model';
import type { Cardinality, DbAction, Edge, EdgeShape, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { SwatchGrid, type SwatchOption } from '@sododeck/ui/components/swatch-grid';
import { Switch } from '@sododeck/ui/components/switch';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Link2, RotateCcw } from 'lucide-react';
import { useId } from 'react';

import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { ON_DELETE, cardinalityLabel } from '../../actions/relationship-actions';
import { FieldEdit } from '../../field-edit';
import { FieldLabel } from '../../fields/field-label';
import { applyLineType, LINE_TYPES } from '../../fields/line-type';
import { oneStep } from '../../fields/one-step';
import { PickField } from '../../fields/pick-field';
import { applyLineStyle } from '../../line-style/apply-line-style';
import { editableEdges } from '../../lock';
import { CARD_COLORS, colourName } from '../../style/card-style';
import { InspectorFrame } from '../inspector-frame';
import { CardinalityChoice } from './cardinality-choice';
import { ColumnPairs } from './column-pairs';

type EdgePatch = Parameters<ReturnType<typeof useEditor>['update']>[2];

const NOT_SET = 'none';
const NO_COLOUR = 'none';
const ACTION_OPTIONS = ON_DELETE.map(({ value, label }) => ({
  value,
  label: value === 'none' ? 'Not set' : label,
}));

const SUBLINE: Record<Cardinality, string> = {
  '1-1': 'one-to-one',
  '1-n': 'one-to-many',
  'n-1': 'many-to-one',
  'n-n': 'many-to-many',
};

function endLabel(deck: SododeckFile, nodeId: string, columns: readonly string[] | undefined) {
  const table = deck.nodes.find((n) => n.id === nodeId);
  const names = (columns ?? []).map((id) => table?.columns?.find((c) => c.id === id)?.name ?? id);
  const title = table?.title ?? nodeId;
  return names.length === 0 ? title : `${title}.${names.join(', ')}`;
}

/**
 * The relationship drawer (052 US2, frame 164): the column pairs (composite ends), cardinality,
 * optional sides, referential actions, and the name, line and colour. Every change is one undo
 * step; the optional flags are written `true` or removed, "Not set" removes the action.
 */
export function RelationshipInspector({ deck, edge }: { deck: SododeckFile; edge: Edge }) {
  const editor = useEditor();
  const base = useId();
  const announce = useUiStore((s) => s.announce);
  const write = (patch: EdgePatch, said?: string) => {
    oneStep(editor, () => {
      editor.update('edges', edge.id, patch);
    });
    if (said !== undefined) announce(said);
  };

  const colour = edge.style?.color;
  const swatches: SwatchOption[] = [
    { value: NO_COLOUR, label: 'No colour', swatch: 'var(--color-border)' },
    ...CARD_COLORS.map((name) => ({
      value: name,
      label: colourName(name),
      swatch: `var(--color-card-${name}-stroke)`,
    })),
  ];

  return (
    <InspectorFrame
      icon={<Link2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={`${endLabel(deck, edge.from, edge.fromColumns)} → ${endLabel(deck, edge.to, edge.toColumns)}`}
      subtitle={edge.cardinality === undefined ? 'Relationship' : SUBLINE[edge.cardinality]}
    >
      <div key={edge.id} className="contents">
        <PanelSection label="Columns">
          <ColumnPairs
            deck={deck}
            edge={edge}
            onWrite={(pairs) => {
              write(pairs, 'Column pairs changed');
            }}
          />
        </PanelSection>
        <PanelSection>
          <FieldLabel id={`${base}-cardinality`}>Cardinality</FieldLabel>
          <CardinalityChoice
            edge={edge}
            onPick={(value) => {
              write({ cardinality: value }, `Cardinality ${cardinalityLabel(value)}`);
            }}
          />
          {edge.cardinality === 'n-n' && (
            <p className="text-caption text-ink-secondary">SQL export writes a junction table</p>
          )}
          {(['from', 'to'] as const).map((side) => {
            const key = side === 'from' ? 'fromOptional' : 'toOptional';
            const label = side === 'from' ? 'From side optional' : 'To side optional';
            return (
              <div key={side} className="flex items-center gap-2">
                <Switch
                  id={`${base}-${side}`}
                  checked={edge[key] === true}
                  onCheckedChange={(on) => {
                    write({ [key]: on ? true : null }, `${label} ${on ? 'on' : 'off'}`);
                  }}
                />
                <label htmlFor={`${base}-${side}`} className="text-body-sm font-medium text-ink">
                  {label}
                </label>
              </div>
            );
          })}
        </PanelSection>
        <PanelSection label="Referential actions" className="grid grid-cols-2 gap-3">
          {(['onDelete', 'onUpdate'] as const).map((key) => (
            <PickField
              key={key}
              label={key === 'onDelete' ? 'On delete' : 'On update'}
              listLabel={key === 'onDelete' ? 'On delete actions' : 'On update actions'}
              value={edge[key] ?? NOT_SET}
              options={ACTION_OPTIONS}
              onPick={(value) => {
                write({ [key]: value === NOT_SET ? null : (value as DbAction) });
              }}
            />
          ))}
        </PanelSection>
        <PanelSection label="Name · Line · Colour">
          <FieldEdit
            label="Name"
            value={edge.label ?? ''}
            allowEmpty
            placeholder="Constraint name"
            onCommit={(label) => {
              editor.update('edges', edge.id, { label: label === '' ? null : label });
            }}
          />
          <FieldLabel id={`${base}-line`}>Line type</FieldLabel>
          <SegmentedControl
            aria-label="Line type"
            // The effective shape: a relationship without one is drawn as an elbow (064).
            value={edgeShape(edge)}
            onValueChange={(value) => {
              if (value !== '') applyLineType(editor, [edge.id], value as EdgeShape);
            }}
            className="h-auto w-full"
          >
            {LINE_TYPES.map(({ value, label, icon: Icon }) => (
              <SegmentedControlItem key={value} value={value} className="h-10 flex-1">
                <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
                {label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            disabled={edge.route === undefined}
            onClick={() => {
              // A locked relationship refuses a reshape (053): nothing written, the hint shown.
              if (editableEdges(editor, [edge.id]) === null) return;
              oneStep(editor, () => {
                editor.setEdgeRoute(edge.id, null);
              });
              announce('Route reset');
            }}
          >
            <RotateCcw aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
            Reset route
          </Button>
          <FieldLabel id={`${base}-colour`}>Colour</FieldLabel>
          <SwatchGrid
            label="Colour"
            options={swatches}
            value={colour === undefined ? null : colour}
            columns={7}
            onSelect={(value) => {
              const next = value === NO_COLOUR ? null : value;
              applyLineStyle(
                editor,
                [edge.id],
                { color: next },
                next === null ? 'Line colour cleared' : `Line colour ${colourName(next)}`,
              );
            }}
          />
        </PanelSection>
      </div>
    </InspectorFrame>
  );
}
