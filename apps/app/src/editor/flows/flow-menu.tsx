import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Ellipsis, FolderInput, ListOrdered, Pencil, Route, Trash2 } from 'lucide-react';

import { dropdownKit } from '../../lib/menu-kit';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { featureOf, moveToFeature } from './flow-order';
import { startEditing } from './flow-session';

const NO_FEATURE = '';

/** "Flow actions: <title>": Open, Edit steps, Rename, Move to feature ▸, Delete… (FR-003). */
export function FlowMenu({
  deck,
  flowId,
  title,
  onRename,
}: {
  deck: SododeckFile;
  flowId: string;
  title: string;
  onRename: () => void;
}) {
  const editor = useEditor();
  const { Item, Sub, SubTrigger, SubContent, RadioGroup, RadioItem, Separator } = dropdownKit;
  const flow = deck.flows.find((f) => f.id === flowId);
  const current = flow === undefined ? null : featureOf(deck, flow);
  const ui = () => useUiStore.getState();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Flow actions: ${title}`}
          className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <Item
          onSelect={() => {
            ui().setActiveFlow(flowId);
          }}
        >
          <Route />
          Open
        </Item>
        <Item
          onSelect={() => {
            startEditing(editor, flowId);
          }}
        >
          <ListOrdered />
          Edit steps
        </Item>
        <Item shortcut="F2" onSelect={onRename}>
          <Pencil />
          Rename
        </Item>
        <Sub>
          <SubTrigger>
            <FolderInput />
            Move to feature
          </SubTrigger>
          <SubContent>
            <RadioGroup
              value={current ?? NO_FEATURE}
              onValueChange={(value) => {
                const featureId = value === NO_FEATURE ? null : value;
                if (featureId === current) return;
                moveToFeature(editor, flowId, featureId);
                const name = deck.features.find((f) => f.id === featureId)?.title ?? 'No feature';
                ui().announce(`Moved ‘${title}’ to ${name}`);
              }}
            >
              {deck.features.map((feature) => (
                <RadioItem key={feature.id} value={feature.id}>
                  {feature.title}
                </RadioItem>
              ))}
              <RadioItem value={NO_FEATURE}>No feature</RadioItem>
            </RadioGroup>
          </SubContent>
        </Sub>
        <Separator />
        <Item
          destructive
          onSelect={() => {
            ui().requestRemoval([{ scope: 'flows', id: flowId }]);
          }}
        >
          <Trash2 />
          Delete…
        </Item>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
