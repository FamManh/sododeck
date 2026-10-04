import type { ColorRef, Node, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react';

import { IconTileButton } from '../icons/icon-tile-button';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldEdit } from '../field-edit';
import { AttachedRules } from '../fields/attached-rules';
import { LinksField } from '../fields/links-field';
import { MarkdownField } from '../fields/markdown-field';
import { oneStep } from '../fields/one-step';
import { PickField } from '../fields/pick-field';
import { TypedFieldsSection } from '../fields/typed-fields-section';
import { CardTagsField } from '../tags/card-tags-field';
import { typeName } from '../type-label';
import { LEVEL_NAMES, nodeLevel } from '../levels';
import { addDeckColour, applyStyle, removeDeckColour } from '../style/apply-style';
import { AppearanceSection } from './appearance-section';
import { groupName, groupOptions, NO_GROUP, typeOptions } from './choices';
import { nodeConnections, styleView } from './derive';
import { InspectorFrame } from './inspector-frame';
import { PinSwitch } from '../views/pin-controls';
import { ShowAsField } from './show-as-field';
import { SizeFields } from './size-fields';

type NodePatch = Parameters<ReturnType<typeof useEditor>['update']>[2];

/**
 * Component inspector (FR-008, designs 02, 18, 23): title, type, group, markdown description,
 * typed fields (032: the type's fields with Tech, Host and Owner among them), tags, links,
 * attached rules and connections. Text fields save while
 * typing; choices and list edits are one undo step each.
 */
export function NodeInspector({ deck, node }: { deck: SododeckFile; node: Node }) {
  const editor = useEditor();
  const write = (patch: NodePatch) => {
    editor.update('nodes', node.id, patch);
  };
  const writeOnce = (patch: NodePatch) => {
    oneStep(editor, () => {
      write(patch);
    });
  };
  const text = (value: string) => (value === '' ? null : value);
  const connections = nodeConnections(deck, node.id);
  const style = styleView([node]);
  const applyNodeStyle = (channel: 'fill' | 'stroke', value: ColorRef | null) => {
    applyStyle(editor, { nodes: [node.id], groups: [], edges: [], stickies: [] }, channel, value);
  };
  const addNodeColour = (channel: 'fill' | 'stroke', hex: string) => {
    addDeckColour(editor, { nodes: [node.id], groups: [], edges: [], stickies: [] }, channel, hex);
  };
  const removeNodeColour = (hex: string) => {
    removeDeckColour(editor, hex);
  };
  const titleOf = (id: string) => deck.nodes.find((n) => n.id === id)?.title ?? id;
  const level = nodeLevel(deck, node.id);
  const levelText =
    level === undefined
      ? 'Unknown'
      : `${LEVEL_NAMES[level]}${node.level === undefined ? ' (derived)' : ''}`;

  return (
    <InspectorFrame
      plainIcon
      icon={<IconTileButton node={node} />}
      heading={node.title}
      subtitle={`${typeName(node.type)} · ${groupName(deck, node.group)} · ${node.id}`}
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete component"
          onClick={() => {
            useUiStore.getState().requestDelete({ nodes: [node.id], edges: [] });
          }}
        >
          <Trash2 />
        </Button>
      }
    >
      <div key={node.id} className="contents">
        <PanelSection>
          <FieldEdit
            label="Title"
            value={node.title}
            onCommit={(title) => {
              write({ title });
            }}
          />
        </PanelSection>
        <PanelSection className="grid grid-cols-2 gap-3">
          <PickField
            label="Type"
            listLabel="Types"
            maxOptions={32}
            value={node.type}
            options={typeOptions(deck, [node.type])}
            onPick={(type) => {
              writeOnce({ type });
            }}
          />
          <PickField
            label="Group"
            listLabel="Groups"
            value={node.group ?? NO_GROUP}
            options={groupOptions(deck)}
            onPick={(group) => {
              writeOnce({ group: group === NO_GROUP ? null : group });
            }}
          />
        </PanelSection>
        <ShowAsField node={node} />
        <PanelSection>
          <div className="flex items-center justify-between gap-3 text-body">
            <span className="text-ink-secondary">Level</span>
            <span>{levelText}</span>
          </div>
        </PanelSection>
        <PanelSection>
          <MarkdownField
            modeKey={`nodes:${node.id}`}
            value={node.description ?? ''}
            placeholder="What does this component do? Markdown supported."
            onCommit={(description) => {
              write({ description: text(description) });
            }}
          />
        </PanelSection>
        <TypedFieldsSection deck={deck} nodes={[node]} />
        <PanelSection>
          <CardTagsField
            nodeId={node.id}
            tags={node.tags}
            onCommit={(tags) => {
              writeOnce({ tags });
            }}
          />
        </PanelSection>
        <PanelSection>
          <LinksField
            value={node.links}
            onCommit={(links) => {
              writeOnce({ links });
            }}
          />
        </PanelSection>
        <PanelSection>
          <PinSwitch nodeIds={[node.id]} />
        </PanelSection>
        <SizeFields node={node} />
        <AppearanceSection
          value={style}
          deckColours={(deck.swatches ?? []).map((hex) => ({ hex }))}
          onApply={applyNodeStyle}
          onAddColour={addNodeColour}
          onRemoveColour={removeNodeColour}
        />
        <AttachedRules deck={deck} host={{ kind: 'node', id: node.id }} ruleIds={node.rules} />
        <PanelSection label={`Connections · ${String(connections.length)}`}>
          {connections.length === 0 ? (
            <p className="text-body-sm text-ink-secondary">No connections yet.</p>
          ) : (
            <ul aria-label="Connections" className="flex flex-col">
              {connections.map((c) => {
                const Icon = c.direction === 'out' ? ArrowUpRight : ArrowDownLeft;
                const name = `${c.direction === 'out' ? '→' : '←'} ${titleOf(c.otherId)}`;
                return (
                  <li key={c.edgeId}>
                    <button
                      type="button"
                      aria-label={name}
                      onClick={() => {
                        useUiStore.getState().select({ edges: [c.edgeId] });
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2 rounded-row px-2 py-1.5 text-left hover:bg-surface-2',
                        focusRing,
                      )}
                    >
                      <Icon
                        aria-hidden
                        strokeWidth={ICON_STROKE_WIDTH}
                        className="size-4 shrink-0 text-ink-secondary"
                      />
                      <span className="min-w-0 flex-1 truncate text-body">
                        {titleOf(c.otherId)}
                      </span>
                      {c.label !== undefined && (
                        <span className="max-w-32 truncate font-mono text-caption text-ink-secondary">
                          {c.label}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelSection>
      </div>
    </InspectorFrame>
  );
}
