import { ChoiceList } from '@sododeck/ui/components/choice-list';
import { InlineEdit } from '@sododeck/ui/components/inline-edit';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarText,
} from '@sododeck/ui/components/toolbar';
import { Ellipsis, PanelRight, Shapes, Tags, User } from 'lucide-react';
import { useState } from 'react';

import { SampleRow } from './sample-row';

const OWNERS = ['Payments team', 'Platform', 'Search'];

/** The 019 quick-edit building blocks: selection toolbar, its field popover, in-card title edit. */
export function QuickEditSamples() {
  const [owner, setOwner] = useState<string | null>('Payments team');
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [title, setTitle] = useState('Order Service');
  const [tags, setTags] = useState<readonly string[]>(['edge']);

  return (
    <>
      <SampleRow label="toolbar">
        <Toolbar aria-label="Selection: Order Service">
          <ToolbarButton aria-label="Open details">
            <PanelRight aria-hidden strokeWidth={1.5} />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton aria-label="Kind: Service">
            <Shapes aria-hidden strokeWidth={1.5} />
          </ToolbarButton>
          <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
            <PopoverTrigger asChild>
              <ToolbarButton aria-label={`Owner: ${owner ?? 'none'}`} aria-haspopup="dialog">
                <User aria-hidden strokeWidth={1.5} />
                {owner ?? 'No owner'}
              </ToolbarButton>
            </PopoverTrigger>
            <PopoverContent aria-label="Owner" className="w-60 shadow-menu">
              <ChoiceList
                label="Owner options"
                filterLabel="Filter owner"
                options={OWNERS.map((value) => ({
                  value,
                  label: value,
                  ...(value === owner ? { state: 'selected' as const } : {}),
                }))}
                none={{ label: 'No owner' }}
                create={(typed) =>
                  typed.trim() === '' || OWNERS.includes(typed.trim())
                    ? null
                    : `Use '${typed.trim()}'`
                }
                onPick={(value) => {
                  setOwner(value);
                  setOwnerOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <ToolbarButton aria-label="Tags" data-state="open">
            <Tags aria-hidden strokeWidth={1.5} />
          </ToolbarButton>
          <ToolbarButton aria-label="Links" disabled>
            Links
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton aria-label="More actions">
            <Ellipsis aria-hidden strokeWidth={1.5} />
          </ToolbarButton>
        </Toolbar>
        <Toolbar aria-label="Selection: 3 components">
          <ToolbarText>3 selected</ToolbarText>
          <ToolbarSeparator />
          <ToolbarButton>Kind</ToolbarButton>
          <ToolbarButton>Owner: Mixed</ToolbarButton>
        </Toolbar>
      </SampleRow>
      <SampleRow label="choice list">
        <div className="w-60 rounded-card border border-border bg-surface p-3 shadow-menu">
          <ChoiceList
            label="Tags options"
            filterLabel="Filter tags"
            multiple
            mixed
            autoFocus={false}
            options={[
              { value: 'pci', label: 'pci', state: 'partial', count: '2 of 3' },
              ...['edge', 'public', 'internal'].map((value) => ({
                value,
                label: value,
                ...(tags.includes(value) ? { state: 'selected' as const } : {}),
              })),
            ]}
            onPick={(value) => {
              if (value === null) return;
              setTags((current) =>
                current.includes(value) ? current.filter((t) => t !== value) : [...current, value],
              );
            }}
          />
        </div>
      </SampleRow>
      <SampleRow label="title edit">
        <span className="flex h-[50px] w-[164px] items-center rounded-node border border-border bg-surface px-2.5 shadow-rest">
          <InlineEdit
            label="Component title"
            value={title}
            onCommit={(next) => {
              if (next.trim() !== '') setTitle(next.trim());
            }}
            className="h-6 w-full px-1 text-body-sm font-medium"
          />
        </span>
        <span className="flex h-[50px] w-[164px] items-center rounded-node border border-border bg-surface px-2.5 shadow-rest">
          <InlineEdit
            label="New component title"
            value="Untitled service"
            startEmpty
            placeholder="Name this component"
            onCommit={() => undefined}
            className="h-6 w-full px-1 text-body-sm font-medium"
          />
        </span>
      </SampleRow>
    </>
  );
}
