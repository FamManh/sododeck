import type { Edge, Node } from '@sododeck/schema';
import { ChoiceList } from '@sododeck/ui/components/choice-list';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { addTag, normalizeTag, removeTag } from '@sododeck/ui/lib/tags';
import type { ReactNode } from 'react';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore, type Selection, type ToolbarFieldId } from '../../state/ui-store';
import { DIRECTIONS, PROTOCOLS } from '../fields/edge-choices';
import { AttachedRules } from '../fields/attached-rules';
import { LinksField } from '../fields/links-field';
import { oneStep } from '../fields/one-step';
import { writeNodesOnce, type NodePatch } from '../fields/write-nodes';
import { KIND_OPTIONS } from '../inspector/choices';
import { bulkView, styleView, tagSuggestions } from '../inspector/derive';
import { applyStyle, skippedCount } from '../style/apply-style';
import { StylePicker } from '../style/style-picker';
import { choiceState, deckValues, tagChoices } from './choice-state';

/** The popover's accessible name per field (contract "Field popover"). */
const FIELD_NAMES: Readonly<Record<ToolbarFieldId, string>> = {
  kind: 'Kind',
  owner: 'Owner',
  tags: 'Tags',
  tech: 'Technology',
  links: 'Links',
  rules: 'Rules',
  protocol: 'Protocol',
  direction: 'Direction',
  style: 'Colour',
};

const count = (n: number) => `${String(n)} ${n === 1 ? 'component' : 'components'}`;
const announce = (text: string) => {
  useUiStore.getState().announce(text);
};

/** "Use 'x'" for typed text that is not an option yet. */
const typedChoice = (existing: readonly string[]) => (typed: string) => {
  const value = typed.trim();
  return value === '' || existing.includes(value) ? null : `Use '${value}'`;
};

function NodeFieldContent({ field, nodes }: { field: ToolbarFieldId; nodes: readonly Node[] }) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const view = bulkView(nodes);
  const n = nodes.length;
  const close = () => {
    useUiStore.getState().closeToolbarField();
  };
  const write = (patch: (node: Node) => NodePatch | null) => {
    writeNodesOnce(editor, nodes, patch);
  };

  switch (field) {
    case 'kind':
      return (
        <ChoiceList
          label="Kind options"
          filterLabel="Filter kind"
          options={choiceState(view.kind, KIND_OPTIONS)}
          mixed={view.kind.mixed}
          onPick={(value) => {
            const option = KIND_OPTIONS.find((o) => o.value === value);
            if (option === undefined) return;
            write(() => ({ type: option.value as Node['type'] }));
            announce(`Kind set to ${option.label} on ${count(n)}`);
            close();
          }}
        />
      );
    case 'owner':
    case 'tech': {
      const values = deckValues(deck, field);
      const shared = field === 'owner' ? view.owner : view.tech;
      const name = field === 'owner' ? 'Owner' : 'Technology';
      return (
        <ChoiceList
          label={`${name} options`}
          filterLabel={`Filter ${name.toLowerCase()}`}
          options={choiceState(
            shared,
            values.map((value) => ({ value, label: value })),
          )}
          mixed={shared.mixed}
          none={{ label: field === 'owner' ? 'No owner' : 'No technology' }}
          create={typedChoice(values)}
          onPick={(value) => {
            write(() => (field === 'owner' ? { owner: value } : { tech: value }));
            announce(
              value === null
                ? `${name} cleared on ${count(n)}`
                : `${name} set to ${value} on ${count(n)}`,
            );
            close();
          }}
        />
      );
    }
    case 'tags': {
      const options = tagChoices(nodes, tagSuggestions(deck));
      return (
        <ChoiceList
          label="Tags options"
          filterLabel="Filter tags"
          multiple
          options={options}
          create={typedChoice(options.map((o) => o.value))}
          onPick={(value) => {
            const tag = value === null ? null : normalizeTag(value);
            if (tag === null) return;
            // On every component: remove it; on some or none: add it to all (spec US3 AC3).
            const onAll = options.some((o) => o.value === tag && o.state === 'selected');
            write((node) => {
              const before = node.tags ?? [];
              const after = onAll ? removeTag(before, tag) : addTag(before, tag);
              return after === before ? null : { tags: after.length === 0 ? null : [...after] };
            });
            announce(
              onAll ? `Tag ${tag} removed from ${count(n)}` : `Tag ${tag} added to ${count(n)}`,
            );
          }}
        />
      );
    }
    case 'links': {
      const [node] = nodes;
      if (node === undefined) return null;
      return (
        <LinksField
          value={node.links}
          onCommit={(links) => {
            oneStep(editor, () => {
              editor.update('nodes', node.id, { links });
            });
          }}
        />
      );
    }
    case 'rules': {
      const [node] = nodes;
      if (node === undefined) return null;
      return (
        <AttachedRules deck={deck} host={{ kind: 'node', id: node.id }} ruleIds={node.rules} />
      );
    }
    default:
      return null;
  }
}

function EdgeFieldContent({ field, edge }: { field: ToolbarFieldId; edge: Edge }) {
  const editor = useEditor();
  const choices =
    field === 'protocol'
      ? PROTOCOLS.map(({ value, label }) => ({ value, label }))
      : DIRECTIONS.map(({ value, label }) => ({ value, label }));
  const current = field === 'protocol' ? edge.protocol : (edge.direction ?? 'forward');
  const name = FIELD_NAMES[field];
  return (
    <ChoiceList
      label={`${name} options`}
      filterLabel={`Filter ${name.toLowerCase()}`}
      options={choiceState(
        current === undefined ? { mixed: true } : { mixed: false, value: current },
        choices,
      )}
      {...(field === 'protocol' ? { none: { label: 'No protocol' } } : {})}
      onPick={(value) => {
        const choice = choices.find((c) => c.value === value);
        oneStep(editor, () => {
          editor.update(
            'edges',
            edge.id,
            field === 'protocol'
              ? { protocol: (choice?.value ?? null) as Edge['protocol'] | null }
              : { direction: (choice?.value ?? 'forward') as Edge['direction'] },
          );
        });
        announce(choice === undefined ? `${name} cleared` : `${name} set to ${choice.label}`);
        useUiStore.getState().closeToolbarField();
      }}
    />
  );
}

/** Colour (020 T032): reads both nodes and groups, unlike `NodeFieldContent`. */
function StyleFieldContent({ selection }: { selection: Selection }) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const nodeIds = new Set(selection.nodes);
  const groupIds = new Set(selection.groups);
  const objects = [
    ...deck.nodes.filter((n) => nodeIds.has(n.id)),
    ...deck.groups.filter((g) => groupIds.has(g.id)),
  ];
  const view = styleView(objects);
  const skipped = skippedCount(selection);
  return (
    <StylePicker
      value={view}
      skipped={
        skipped > 0 ? { colored: objects.length, total: objects.length + skipped } : undefined
      }
      onApply={(channel, value) => {
        applyStyle(editor, selection, channel, value);
      }}
    />
  );
}

/** What a field popover edits: the selected components, or the one selected connection. */
function FieldContent({ field }: { field: ToolbarFieldId }) {
  const deck = useDeckSnapshot(useEditor().doc);
  const selection = useUiStore((s) => s.selection);
  if (field === 'protocol' || field === 'direction') {
    const edge = deck.edges.find((e) => e.id === selection.edges[0]);
    return edge === undefined ? null : <EdgeFieldContent field={field} edge={edge} />;
  }
  if (field === 'style') {
    return <StyleFieldContent selection={selection} />;
  }
  const ids = new Set(selection.nodes);
  return <NodeFieldContent field={field} nodes={deck.nodes.filter((n) => ids.has(n.id))} />;
}

/**
 * A toolbar field button with its popover (019 R6, contract "Field popover"): a `dialog` named
 * after the field, open while `ui.toolbarField` names it. Picks write through the editor, one
 * undo step for the whole selection. Esc closes it and Radix gives focus back to the button.
 */
export function FieldPopover({
  field,
  tooltip,
  children,
}: {
  field: ToolbarFieldId;
  /** The button's tooltip (name and shortcut). */
  tooltip: string;
  /** The toolbar button that opens it. */
  children: ReactNode;
}) {
  const open = useUiStore((s) => s.toolbarField === field);
  const wide = field === 'links' || field === 'rules' || field === 'style';
  return (
    <Tooltip>
      <Popover
        open={open}
        onOpenChange={(next) => {
          const ui = useUiStore.getState();
          if (next) ui.openToolbarField(field);
          else if (ui.toolbarField === field) ui.closeToolbarField();
        }}
      >
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>{children}</PopoverTrigger>
        </TooltipTrigger>
        <PopoverContent
          aria-label={FIELD_NAMES[field]}
          align="start"
          className={wide ? 'w-[272px] shadow-menu' : 'w-[236px] shadow-menu'}
        >
          <FieldContent field={field} />
        </PopoverContent>
      </Popover>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
