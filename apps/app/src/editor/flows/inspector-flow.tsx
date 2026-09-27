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
import { CircleAlert, ListOrdered, Route, Trash2 } from 'lucide-react';
import { useId } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldEdit } from '../field-edit';
import { featureOf, moveToFeature } from './flow-order';
import { startEditing } from './flow-session';
import { InspectorFrame } from '../inspector/inspector-frame';
import { LinksField } from '../fields/links-field';
import { MarkdownField } from '../fields/markdown-field';
import { oneStep } from '../fields/one-step';
import { OwnerField } from '../fields/owner-field';
import { TagsField } from '../fields/tags-field';
import { flowSummary } from '../inspector/derive';

const NO_FEATURE = 'none';

const plural = (n: number, one: string, many = `${one}s`) => `${String(n)} ${n === 1 ? one : many}`;

/**
 * Flow inspector (006 FR-003, 008 FR-010, designs 42, 50): title, a summary line, markdown
 * description, owner with suggestions, feature (including "No feature"), tags, links and Edit
 * steps. Text fields save while typing.
 */
export function InspectorFlow({ deck, flow }: { deck: SododeckFile; flow: Flow }) {
  const editor = useEditor();
  const session = useUiStore((s) => s.flowSession);
  const featureLabelId = useId();
  const featureId = featureOf(deck, flow);
  const summary = flowSummary(deck, flow.id);
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
      {summary !== null && (
        <PanelSection>
          <p className="flex items-center gap-1.5 text-body-sm text-ink-secondary">
            {`${plural(summary.steps, 'step')} · ${plural(summary.branches, 'branch', 'branches')} · ${plural(summary.components, 'component')}`}
            {summary.broken > 0 && (
              <span className="flex items-center gap-1 text-clay-ink">
                {' · '}
                <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
                {plural(summary.broken, 'broken step')}
              </span>
            )}
          </p>
        </PanelSection>
      )}
      <PanelSection>
        <MarkdownField
          key={`${flow.id}-description`}
          modeKey={`flows:${flow.id}`}
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
        <OwnerField
          key={`${flow.id}-owner`}
          deck={deck}
          value={flow.owner ?? ''}
          onCommit={(owner) => {
            editor.update('flows', flow.id, { owner: owner === '' ? null : owner });
          }}
        />
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
      <PanelSection>
        <TagsField
          deck={deck}
          value={flow.tags}
          onCommit={(tags) => {
            oneStep(editor, () => {
              editor.update('flows', flow.id, { tags });
            });
          }}
        />
      </PanelSection>
      <PanelSection>
        <LinksField
          key={`${flow.id}-links`}
          value={flow.links}
          onCommit={(links) => {
            oneStep(editor, () => {
              editor.update('flows', flow.id, { links });
            });
          }}
        />
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
