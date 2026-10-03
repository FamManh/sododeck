import type { ColorRef, Node, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { TagChip } from '@sododeck/ui/components/tag-chip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { addTag, removeTag, tagKey } from '@sododeck/ui/lib/tags';
import { cn } from '@sododeck/ui/lib/utils';
import { Info, Layers, Plus, Trash2 } from 'lucide-react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldEdit } from '../field-edit';
import { FieldLabel } from '../fields/field-label';
import { OwnerField } from '../fields/owner-field';
import { PickField } from '../fields/pick-field';
import { writeNodes, writeNodesOnce, type NodePatch } from '../fields/write-nodes';
import { addDeckColour, applyStyle, removeDeckColour, skippedCount } from '../style/apply-style';
import { AppearanceSection } from './appearance-section';
import { groupOptions, NO_GROUP, typeOptions } from './choices';
import { bulkView, styleView, type Shared } from './derive';
import { InspectorFrame } from './inspector-frame';
import { PinSwitch } from '../views/pin-controls';
import { MAX_CARD_TAGS } from '../card-tags';
import { tagColourMap } from '../tags/card-tag-looks';
import { tagColours } from '../tags/tag-colours';
import { TagPicker } from '../tags/tag-picker';
import { tagPickerEscape } from '../tags/tag-picker-escape';

const plural = (n: number, one: string) => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/**
 * Bulk edit of several components (FR-013–FR-017, design 58): type, owner, tech, group and tags.
 * A field whose values differ shows "Mixed" and changes nothing until the user types or picks;
 * each change applies to every selected component as one undo step. Connections in the
 * selection are counted but never changed.
 */
export function BulkInspector({
  deck,
  nodes,
  edgeIds,
}: {
  deck: SododeckFile;
  nodes: readonly Node[];
  edgeIds: readonly string[];
}) {
  const editor = useEditor();
  const view = bulkView(nodes);
  const n = nodes.length;
  const ids = nodes.map((node) => node.id);
  const same = (shared: Shared<unknown>) => (shared.mixed ? undefined : `Same on all ${String(n)}`);
  const styleSelection = { nodes: ids, edges: edgeIds, groups: [], stickies: [] };
  const style = styleView(nodes);
  const styleSkipped = skippedCount(styleSelection);
  const applyBulkStyle = (channel: 'fill' | 'stroke', value: ColorRef | null) => {
    applyStyle(editor, styleSelection, channel, value);
  };
  const addBulkColour = (channel: 'fill' | 'stroke', hex: string) => {
    addDeckColour(editor, styleSelection, channel, hex);
  };
  const removeBulkColour = (hex: string) => {
    removeDeckColour(editor, hex);
  };

  /** One batch over the selection; inside a text field's gesture, one undo step per edit. */
  const writeAll = (patch: (node: Node) => NodePatch | null) => {
    writeNodes(editor, nodes, patch);
  };
  const writeAllOnce = (patch: (node: Node) => NodePatch | null) => {
    writeNodesOnce(editor, nodes, patch);
  };
  const text = (value: string) => (value === '' ? null : value);
  const setTags = (next: (tags: readonly string[]) => readonly string[]) => {
    writeAllOnce((node) => {
      const before = node.tags ?? [];
      const after = next(before);
      return after === before ? null : { tags: after.length === 0 ? null : [...after] };
    });
  };

  const heading =
    edgeIds.length === 0
      ? `${String(n)} components selected`
      : `${plural(n, 'component')}, ${plural(edgeIds.length, 'connection')} selected`;
  const firstTitles = nodes
    .slice(0, 3)
    .map((node) => node.title)
    .join(', ');

  return (
    <InspectorFrame
      icon={<Layers aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={heading}
      subtitle={n > 3 ? `${firstTitles}, …` : firstTitles}
    >
      <div key={ids.join(' ')} className="contents">
        {edgeIds.length > 0 && (
          <PanelSection>
            <p className="flex items-center gap-2 text-body-sm text-ink-secondary">
              <Info aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
              Changes apply to components only.
            </p>
          </PanelSection>
        )}
        <PanelSection>
          <PinSwitch nodeIds={ids} />
        </PanelSection>
        <AppearanceSection
          value={style}
          deckColours={(deck.swatches ?? []).map((hex) => ({ hex }))}
          onApply={applyBulkStyle}
          onAddColour={addBulkColour}
          onRemoveColour={removeBulkColour}
          skipped={styleSkipped > 0 ? { colored: n, total: n + styleSkipped } : undefined}
        />
        <PanelSection className="grid grid-cols-2 gap-3">
          <PickField
            label="Type"
            listLabel="Types"
            maxOptions={32}
            value={view.type.mixed ? '' : view.type.value}
            mixed={view.type.mixed}
            hint={same(view.type)}
            options={typeOptions(
              deck,
              nodes.map((node) => node.type),
            )}
            onPick={(type) => {
              writeAllOnce(() => ({ type }));
            }}
          />
          <PickField
            label="Group"
            listLabel="Groups"
            value={view.group.mixed ? '' : (view.group.value ?? NO_GROUP)}
            mixed={view.group.mixed}
            hint={same(view.group)}
            options={groupOptions(deck)}
            onPick={(group) => {
              writeAllOnce(() => ({ group: group === NO_GROUP ? null : group }));
            }}
          />
        </PanelSection>
        <PanelSection className="grid grid-cols-2 gap-3">
          <OwnerField
            deck={deck}
            value={view.owner.mixed ? '' : view.owner.value}
            mixed={view.owner.mixed}
            hint={view.owner.mixed || view.owner.value === '' ? undefined : same(view.owner)}
            onCommit={(owner) => {
              writeAll(() => ({ owner: text(owner) }));
            }}
          />
          <FieldEdit
            label="Tech"
            allowEmpty
            value={view.tech.mixed ? '' : view.tech.value}
            mixed={view.tech.mixed}
            hint={view.tech.mixed || view.tech.value === '' ? undefined : same(view.tech)}
            onCommit={(tech) => {
              writeAll(() => ({ tech: text(tech) }));
            }}
          />
        </PanelSection>
        <PanelSection>
          <BulkTags
            deck={deck}
            nodeIds={ids}
            tags={view.tags}
            onAdd={(tag) => {
              setTags((tags) => addTag(tags, tag, MAX_CARD_TAGS));
            }}
            onRemove={(tag) => {
              setTags((tags) => removeTag(tags, tag));
            }}
          />
        </PanelSection>
        <PanelSection>
          <p className="text-caption text-ink-secondary">
            Fields marked Mixed keep each component&apos;s own value until you type a new one.
            Dashed tags are on some components only.
          </p>
          <Button
            className="self-start border-clay-ink text-clay-ink hover:bg-clay-soft"
            onClick={() => {
              useUiStore.getState().requestDelete({ nodes: ids, edges: [] });
            }}
          >
            <Trash2 />
            Delete {n} components
          </Button>
        </PanelSection>
      </div>
    </InspectorFrame>
  );
}

/** Tags across the selection: solid on all, dashed "k/n" on some (FR-016), in each tag's colour. */
function BulkTags({
  deck,
  nodeIds,
  tags,
  onAdd,
  onRemove,
}: {
  deck: SododeckFile;
  nodeIds: readonly string[];
  tags: readonly { tag: string; count: number }[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const total = nodeIds.length;
  const colours = tagColourMap(deck.tagColors);
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Tags</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        <ul aria-label="Tags" className="contents">
          {tags.map(({ tag, count }) => {
            const partial = count < total;
            const look = tagColours(colours.get(tagKey(tag)));
            return (
              <li key={tag} className="contents">
                <TagChip
                  label={tag}
                  colour={{ chip: look.chip, ink: look.ink }}
                  partial={partial}
                  count={partial ? `${String(count)}/${String(total)}` : undefined}
                  onActivate={
                    partial
                      ? () => {
                          onAdd(tag);
                        }
                      : undefined
                  }
                  activateLabel={`Add ${tag} to all`}
                  onRemove={() => {
                    onRemove(tag);
                  }}
                  removeLabel={`Remove ${tag} from all`}
                />
              </li>
            );
          })}
        </ul>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add tag"
              className={cn(
                'inline-flex h-6.5 cursor-pointer items-center gap-1 rounded-full border border-dashed border-ink-muted px-2.5 text-body-sm text-ink-secondary hover:text-ink',
                focusRing,
              )}
            >
              <Plus aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
              Add tag
            </button>
          </PopoverTrigger>
          <PopoverContent aria-label="Tags" onEscapeKeyDown={tagPickerEscape}>
            <TagPicker nodeIds={nodeIds} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
