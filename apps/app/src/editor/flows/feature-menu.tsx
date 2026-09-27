import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react';

import { dropdownKit } from '../../lib/menu-kit';
import { useUiStore } from '../../state/ui-store';

/** "Feature actions: <title>": Rename, New flow, Delete… (FR-002). */
export function FeatureMenu({
  featureId,
  title,
  onRename,
  onNewFlow,
}: {
  featureId: string;
  title: string;
  onRename: () => void;
  onNewFlow: () => void;
}) {
  const { Item, Separator } = dropdownKit;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Feature actions: ${title}`}
          className="opacity-0 group-focus-within/feature:opacity-100 group-hover/feature:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <Item shortcut="F2" onSelect={onRename}>
          <Pencil />
          Rename
        </Item>
        <Item onSelect={onNewFlow}>
          <Plus />
          New flow
        </Item>
        <Separator />
        <Item
          destructive
          onSelect={() => {
            useUiStore.getState().requestRemoval([{ scope: 'features', id: featureId }]);
          }}
        >
          <Trash2 />
          Delete…
        </Item>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
