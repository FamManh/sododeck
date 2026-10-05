import { Button } from '@sododeck/ui/components/button';
import { CoachMark, CoachMarkAnchor } from '@sododeck/ui/components/coach-mark';
import { CommandDialog } from '@sododeck/ui/components/command-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@sododeck/ui/components/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@sododeck/ui/components/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Input } from '@sododeck/ui/components/input';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { Switch } from '@sododeck/ui/components/switch';
import {
  Copy,
  Download,
  Ellipsis,
  FolderInput,
  Pencil,
  Shapes,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react';
import { useId, useState } from 'react';

import { GallerySection } from './gallery-section';
import { QuickEditSamples } from './quick-edit-samples';
import { SampleRow } from './sample-row';

const TOUR = [
  { title: 'Add your first component', body: 'Drag a type from the Add flyout onto the canvas.' },
  { title: 'Connect it', body: 'Drag from a node edge to another node to draw a call.' },
  { title: 'Trace a flow', body: 'Click edges in order to record a flow, then press Play.' },
];

export function OverlaysSection() {
  const [step, setStep] = useState(0);
  const [touring, setTouring] = useState(false);
  const [folder, setFolder] = useState('logistics');
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState('');
  const notesId = useId();
  const current = TOUR[step] ?? TOUR[0];

  return (
    <GallerySection
      id="overlays"
      title="Dialog, popover and coach mark"
      description="Reference: 06-export-json (dialog, switch), 05-empty-deck-tour-1 (coach mark), 98–104 (selection toolbar, toolbar popover, title edit)."
    >
      <SampleRow label="dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="primary">
              <Download />
              Export…
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[820px]">
            <DialogHeader>
              <DialogTitle>Export deck</DialogTitle>
              <DialogDescription>
                Exports are generated in your browser. Nothing is uploaded.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-caption text-ink-secondary">Format</span>
                <Select defaultValue="json">
                  <SelectTrigger aria-label="Format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON · .sododeck</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="svg">SVG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 self-end pb-2">
                <Switch id={notesId} defaultChecked />
                <label htmlFor={notesId} className="text-body">
                  Include descriptions, links and rules
                </label>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Cancel</Button>
              </DialogClose>
              <Button variant="primary">Download</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SampleRow>
      <SampleRow label="command dialog">
        <Button
          onClick={() => {
            setJumpOpen(true);
          }}
        >
          Jump to…
        </Button>
        <CommandDialog
          open={jumpOpen}
          query={jumpQuery}
          items={[
            { id: 'theme', title: 'Switch theme', meta: 'Command', shortcut: '⌘⇧L' },
            { id: 'flow', title: 'Place order', meta: 'Flow · 8 steps' },
            {
              id: 'note',
              title: 'Retry note',
              meta: 'Note',
              snippet: {
                text: '…follow up on retry behavior…',
                ranges: [{ start: 15, end: 20 }],
              },
            },
          ]}
          total={3}
          onQueryChange={setJumpQuery}
          onOpenChange={setJumpOpen}
          onSelect={() => {
            setJumpOpen(false);
          }}
          emptyState={
            <div>
              <p>No results</p>
              <p>Try a different word.</p>
            </div>
          }
        />
      </SampleRow>
      <SampleRow label="popover">
        <Popover>
          <PopoverTrigger asChild>
            <Button>Edit connection…</Button>
          </PopoverTrigger>
          <PopoverContent aria-label="Connection">
            <span className="text-micro text-ink-muted uppercase">Connection</span>
            <label className="flex flex-col gap-1.5 text-caption text-ink-secondary">
              Label
              <Input defaultValue="POST /orders" />
            </label>
          </PopoverContent>
        </Popover>
      </SampleRow>
      <SampleRow label="dropdown menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions for Logistics Delivery">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem shortcut="↵">
              <SquareArrowOutUpRight />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem shortcut="F2">
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem shortcut="⌘D">
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput />
                Move to folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={folder} onValueChange={setFolder}>
                  <DropdownMenuRadioItem value="unfiled">Unfiled</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="logistics">Logistics</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="payments">Payments</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem>
              <Download />
              Export .sododeck
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive>
              <Trash2 />
              Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SampleRow>
      <SampleRow label="context menu">
        <ContextMenu>
          <ContextMenuTrigger className="rounded-card border border-dashed border-border px-4 py-3 text-body text-ink-secondary">
            Right-click here
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem shortcut="F2">
              <Pencil />
              Rename
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem destructive>
              <Trash2 />
              Delete folder…
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </SampleRow>
      <SampleRow label="coach mark">
        <Button
          onClick={() => {
            setStep(0);
            setTouring(true);
          }}
        >
          Start 3-step tour
        </Button>
        <CoachMark
          open={touring}
          step={step + 1}
          total={TOUR.length}
          title={current?.title}
          onNext={() => {
            setStep((value) => Math.min(value + 1, TOUR.length - 1));
          }}
          onBack={() => {
            setStep((value) => Math.max(value - 1, 0));
          }}
          onSkip={() => {
            setTouring(false);
          }}
          onFinish={() => {
            setTouring(false);
          }}
          anchor={
            <CoachMarkAnchor asChild>
              <span className="inline-flex items-center gap-2 rounded-card border border-dashed border-border px-3 py-2 text-body text-ink-secondary">
                <Shapes className="size-4" strokeWidth={1.5} aria-hidden />
                Palette (tour anchor)
              </span>
            </CoachMarkAnchor>
          }
        >
          {current?.body}
        </CoachMark>
      </SampleRow>
      <QuickEditSamples />
    </GallerySection>
  );
}
