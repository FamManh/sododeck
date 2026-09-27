import type { Flow, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { ListOrdered, Route, Trash2 } from 'lucide-react';
import { useId } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldEdit } from '../field-edit';
import { featureOf, moveToFeature } from './flow-order';
import { startEditing } from './flow-session';
import { InspectorFrame } from '../inspector/inspector-frame';
import { TextareaEdit } from '../fields/textarea-edit';

const NO_FEATURE = 'none';

/** Owners already used in the deck, for suggestions (§g-10: no team list). */
function owners(deck: SododeckFile): string[] {
  const all = [...deck.nodes, ...deck.features, ...deck.flows].flatMap((o) =>
    o.owner === undefined || o.owner === '' ? [] : [o.owner],
  );
  return [...new Set(all)].sort((a, b) => a.localeCompare(b));
}

/**
 * Flow inspector (FR-003, FR-018a, design 42): title, description, owner with suggestions,
 * feature (including "No feature") and Edit steps. Every field saves on Enter or blur.
 */
export function InspectorFlow({ deck, flow }: { deck: SododeckFile; flow: Flow }) {
  const editor = useEditor();
  const session = useUiStore((s) => s.flowSession);
  const ownersId = useId();
  const featureLabelId = useId();
  const featureId = featureOf(deck, flow);
  const featureName = deck.features.find((f) => f.id === featureId)?.title ?? 'No feature';
  const mode =
    session?.flowId === flow.id ? (session.mode === 'record' ? ' · recording' : ' · editing') : '';

  return (
    <InspectorFrame
      icon={<Route aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={flow.title}
      subtitle={`Flow · ${featureName}${mode}`}
      actions={
        session === null && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete flow"
            onClick={() => {
              useUiStore.getState().requestRemoval([{ scope: 'flows', id: flow.id }]);
            }}
          >
            <Trash2 />
          </Button>
        )
      }
    >
      <PanelSection>
        <FieldEdit
          key={`${flow.id}-title`}
          label="Title"
          value={flow.title}
          onCommit={(title) => {
            editor.update('flows', flow.id, { title });
          }}
        />
      </PanelSection>
      <PanelSection>
        <TextareaEdit
          key={`${flow.id}-description`}
          label="Description"
          value={flow.description ?? ''}
          placeholder="What does this flow do? Markdown supported."
          onCommit={(description) => {
            editor.update('flows', flow.id, {
              description: description === '' ? null : description,
            });
          }}
        />
      </PanelSection>
      <PanelSection className="grid grid-cols-2 gap-3">
        <FieldEdit
          key={`${flow.id}-owner`}
          label="Owner"
          value={flow.owner ?? ''}
          allowEmpty
          list={ownersId}
          placeholder="Team or person"
          onCommit={(owner) => {
            editor.update('flows', flow.id, { owner: owner === '' ? null : owner });
          }}
        />
        <datalist id={ownersId}>
          {owners(deck).map((owner) => (
            <option key={owner} value={owner} />
          ))}
        </datalist>
        <div className="flex flex-col gap-1.5">
          <span id={featureLabelId} className="text-micro text-ink-muted uppercase">
            Feature
          </span>
          <Select
            value={featureId ?? NO_FEATURE}
            onValueChange={(value) => {
              moveToFeature(editor, flow.id, value === NO_FEATURE ? null : value);
            }}
          >
            <SelectTrigger aria-labelledby={featureLabelId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {deck.features.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.title}
                </SelectItem>
              ))}
              <SelectItem value={NO_FEATURE}>No feature</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PanelSection>
      {session === null && (
        <PanelSection>
          <Button
            className="self-start"
            onClick={() => {
              startEditing(editor, flow.id);
            }}
          >
            <ListOrdered />
            Edit steps
          </Button>
        </PanelSection>
      )}
    </InspectorFrame>
  );
}
