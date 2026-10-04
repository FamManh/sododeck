import { isDbTable } from '@sododeck/model';
import type { ColorRef, DbDetail, Node, SododeckFile } from '@sododeck/schema';
import type { ComboboxOption } from '@sododeck/ui/components/combobox';
import { PanelSection } from '@sododeck/ui/components/panel';

import { useEditor } from '../../../model/use-editor';
import { oneStep } from '../../fields/one-step';
import { LinksField } from '../../fields/links-field';
import { OwnerField } from '../../fields/owner-field';
import { PickField } from '../../fields/pick-field';
import { addDeckColour, applyStyle, removeDeckColour } from '../../style/apply-style';
import { DETAIL_NAMES } from '../../table/table-text';
import { CardTagsField } from '../../tags/card-tags-field';
import { AppearanceSection } from '../appearance-section';
import { styleView } from '../derive';
import { TableOwnerField } from '../table-owner-field';
import { LiveTextField } from './live-text-field';

type NodePatch = Parameters<ReturnType<typeof useEditor>['update']>[2];

const DECK_DETAIL = 'deck';

const DETAIL_OPTIONS: readonly ComboboxOption[] = [
  { value: DECK_DETAIL, label: 'Use deck setting' },
  { value: 'names', label: DETAIL_NAMES.names },
  { value: 'keys', label: DETAIL_NAMES.keys },
  { value: 'all', label: DETAIL_NAMES.all },
];

const isDetail = (value: string): value is DbDetail =>
  value === 'names' || value === 'keys' || value === 'all';

/** The message for a table that would share `title` with another one in `schema`, else none. */
function duplicateTable(
  deck: SododeckFile,
  tableId: string,
  title: string,
  schema: string | undefined,
): string | undefined {
  const key = title.toLowerCase();
  const clash = deck.nodes.some(
    (n) =>
      n.id !== tableId &&
      isDbTable(n) &&
      n.title.toLowerCase() === key &&
      (n.schema ?? '') === (schema ?? ''),
  );
  return clash
    ? `A table named ${title} already exists in ${schema ?? 'the default schema'}`
    : undefined;
}

/**
 * The table drawer's General tab (052, frame 164): name and schema (unique together), detail,
 * colour, note, owner, tags and links. Text fields save while typing; choices and list edits are
 * one undo step each.
 */
export function GeneralTab({ deck, node }: { deck: SododeckFile; node: Node }) {
  const editor = useEditor();
  const write = (patch: NodePatch) => {
    editor.update('nodes', node.id, patch);
  };
  const writeOnce = (patch: NodePatch) => {
    oneStep(editor, () => {
      write(patch);
    });
  };
  const targets = { nodes: [node.id], groups: [], edges: [], stickies: [] };
  return (
    <div key={node.id} className="contents">
      <PanelSection className="grid grid-cols-2 gap-3">
        <LiveTextField
          label="Name"
          required
          value={node.title}
          validate={(text) => duplicateTable(deck, node.id, text, node.schema)}
          onWrite={(title) => {
            write({ title });
          }}
        />
        <LiveTextField
          label="Schema"
          placeholder="Default"
          value={node.schema ?? ''}
          validate={(text) =>
            duplicateTable(deck, node.id, node.title, text === '' ? undefined : text)
          }
          onWrite={(text) => {
            write({ schema: text === '' ? null : text });
          }}
        />
      </PanelSection>
      <PanelSection>
        <PickField
          label="Detail"
          listLabel="Detail"
          value={node.detail ?? DECK_DETAIL}
          options={DETAIL_OPTIONS}
          onPick={(value) => {
            writeOnce({ detail: isDetail(value) ? value : null });
          }}
        />
      </PanelSection>
      <TableOwnerField deck={deck} node={node} />
      <AppearanceSection
        value={styleView([node])}
        deckColours={(deck.swatches ?? []).map((hex) => ({ hex }))}
        onApply={(channel: 'fill' | 'stroke', value: ColorRef | null) => {
          applyStyle(editor, targets, channel, value);
        }}
        onAddColour={(channel, hex) => {
          addDeckColour(editor, targets, channel, hex);
        }}
        onRemoveColour={(hex) => {
          removeDeckColour(editor, hex);
        }}
      />
      <PanelSection>
        <LiveTextField
          label="Note"
          multiline
          placeholder="What is this table for?"
          value={node.description ?? ''}
          onWrite={(text) => {
            write({ description: text === '' ? null : text });
          }}
        />
      </PanelSection>
      <PanelSection>
        <OwnerField
          deck={deck}
          value={node.owner ?? ''}
          onCommit={(owner) => {
            write({ owner: owner === '' ? null : owner });
          }}
        />
      </PanelSection>
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
    </div>
  );
}
