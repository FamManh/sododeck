import { stickyLabel } from '@sododeck/model';
import type { Sticky } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { Switch } from '@sododeck/ui/components/switch';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { StickyNote, Trash2 } from 'lucide-react';
import { useId } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldLabel } from '../fields/field-label';
import { MarkdownField } from '../fields/markdown-field';
import { oneStep } from '../fields/one-step';
import { CardTagsField } from '../tags/card-tags-field';
import { InspectorFrame } from './inspector-frame';
import { notesAreReadOnly } from '../stickies/sticky-actions';
import { StickyFormatFields } from './sticky-format-fields';

export function StickyInspector({ sticky }: { sticky: Sticky }) {
  const editor = useEditor();
  const readOnly = notesAreReadOnly();
  const announce = useUiStore((state) => state.announce);
  const heading = stickyLabel(sticky.text) ?? 'Note';
  const displayId = useId();
  const switchId = useId();

  return (
    <InspectorFrame
      icon={<StickyNote aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={heading}
      subtitle="Note"
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete note"
          disabled={readOnly}
          onClick={() => {
            useUiStore.getState().requestDelete({ stickies: [sticky.id] });
          }}
        >
          <Trash2 />
        </Button>
      }
    >
      <div key={sticky.id} className="contents">
        <PanelSection>
          <MarkdownField
            modeKey={`stickies:${sticky.id}`}
            label="Note text"
            value={sticky.text}
            placeholder="Add a note in Markdown."
            disabled={readOnly}
            emptyPreviewText="Nothing to preview."
            onCommit={(text) => {
              editor.update('stickies', sticky.id, { text });
            }}
          />
        </PanelSection>
        <PanelSection>
          <FieldLabel id={displayId}>Display</FieldLabel>
          <SegmentedControl
            aria-labelledby={displayId}
            value={sticky.collapsed === true ? 'collapsed' : 'expanded'}
            disabled={readOnly}
            onValueChange={(value) => {
              editor.update('stickies', sticky.id, {
                collapsed: value === 'collapsed' ? true : null,
              });
              announce(value === 'collapsed' ? 'Note collapsed' : 'Note expanded');
            }}
            className="self-start"
          >
            <SegmentedControlItem value="expanded">Expanded</SegmentedControlItem>
            <SegmentedControlItem value="collapsed">Collapsed</SegmentedControlItem>
          </SegmentedControl>
        </PanelSection>
        <StickyFormatFields sticky={sticky} disabled={readOnly} />
        <PanelSection>
          <CardTagsField
            stickyId={sticky.id}
            tags={sticky.tags}
            onCommit={(tags) => {
              oneStep(editor, () => {
                editor.setStickyTags(sticky.id, tags ?? []);
              });
            }}
          />
        </PanelSection>
        <PanelSection>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <label htmlFor={switchId} className="text-body text-ink">
                Stay visible during flows
              </label>
              <span id={`${switchId}-description`} className="text-caption text-ink-secondary">
                Off: dims to 35% while a flow plays
              </span>
            </div>
            <Switch
              id={switchId}
              checked={sticky.showInFlows === true}
              disabled={readOnly}
              aria-describedby={`${switchId}-description`}
              aria-label="Stay visible during flows"
              onCheckedChange={(checked) => {
                editor.update('stickies', sticky.id, { showInFlows: checked ? true : null });
              }}
            />
          </div>
        </PanelSection>
      </div>
    </InspectorFrame>
  );
}
