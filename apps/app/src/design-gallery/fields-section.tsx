import { Checkbox } from '@sododeck/ui/components/checkbox';
import { ColourArea } from '@sododeck/ui/components/colour-area';
import { Combobox } from '@sododeck/ui/components/combobox';
import { HueSlider } from '@sododeck/ui/components/hue-slider';
import { InlineEdit } from '@sododeck/ui/components/inline-edit';
import { MarkdownView } from '@sododeck/ui/components/markdown-view';
import { RadioGroup, RadioGroupItem } from '@sododeck/ui/components/radio-group';
import { Input } from '@sododeck/ui/components/input';
import { SearchField } from '@sododeck/ui/components/search-field';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { Switch } from '@sododeck/ui/components/switch';
import { SwatchGrid } from '@sododeck/ui/components/swatch-grid';
import { Textarea } from '@sododeck/ui/components/textarea';
import { LayoutGrid, List } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { DEMO_FOCUS } from './demo-states';
import { GallerySection } from './gallery-section';
import { SampleRow } from './sample-row';

/** A visible label above a field (every field in the product has one). */
function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex w-60 flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-ink-secondary">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const SWATCH_SAMPLE = [
  { value: 'red', label: 'Red', swatch: 'var(--color-card-red-fill)' },
  { value: 'orange', label: 'Orange', swatch: 'var(--color-card-orange-fill)' },
  { value: 'amber', label: 'Amber', swatch: 'var(--color-card-amber-fill)' },
  { value: 'yellow', label: 'Yellow', swatch: 'var(--color-card-yellow-fill)' },
  { value: 'lime', label: 'Lime', swatch: 'var(--color-card-lime-fill)' },
  { value: 'green', label: 'Green', swatch: 'var(--color-card-green-fill)' },
  { value: 'teal', label: 'Teal', swatch: 'var(--color-card-teal-fill)' },
];

export function FieldsSection() {
  const [deckName, setDeckName] = useState('Checkout platform');
  const [layout, setLayout] = useState('grid');
  const [scope, setScope] = useState('deck');
  const [notes, setNotes] = useState(true);
  const [owner, setOwner] = useState('Orders');
  const [kind, setKind] = useState('service');
  const [swatch, setSwatch] = useState('green');
  const [hsv, setHsv] = useState({ h: 262, s: 0.6, v: 0.4 });
  const switchId = useId();

  return (
    <GallerySection
      id="fields"
      title="Fields and choices"
      description="Input, inline edit, textarea, markdown preview, combobox, select, search field, segmented control, switch. Reference: 02-editor-node-selected, 14-editor-palette-tab, 06-export-json, 18, 58."
    >
      <SampleRow label="input">
        <Field label="Owner">{(id) => <Input id={id} placeholder="team-payments" />}</Field>
        <Field label="Owner (focus)">
          {(id) => (
            <Input
              id={id}
              defaultValue="payments"
              data-demo-state="focus"
              className={`border-primary ${DEMO_FOCUS}`}
            />
          )}
        </Field>
        <Field label="Endpoint (invalid)">
          {(id) => <Input id={id} defaultValue="http//orders" invalid />}
        </Field>
        <Field label="Disabled">
          {(id) => <Input id={id} defaultValue="read only" disabled />}
        </Field>
      </SampleRow>
      <SampleRow label="inline edit">
        <InlineEdit
          label="Deck name"
          value={deckName}
          onCommit={setDeckName}
          className="text-title-sm"
        />
        <InlineEdit
          label="Deck name (hover)"
          value="Hover state"
          onCommit={() => undefined}
          data-demo-state="hover"
          className="border-border"
        />
        <span className="text-caption text-ink-muted">Committed: {deckName}</span>
      </SampleRow>
      <SampleRow label="textarea">
        <Field label="Description (markdown)">
          {(id) => (
            <Textarea
              id={id}
              defaultValue={'## Order Service\nOwns **orders** and emits `order.created`.'}
            />
          )}
        </Field>
      </SampleRow>
      <SampleRow label="markdown preview">
        <MarkdownView
          className="w-72"
          text={'Returns a fee and tier.\n\n- Uses `Delivery tier`\n- <b>HTML</b> stays text'}
        />
        <MarkdownView className="w-40" text="" />
      </SampleRow>
      <SampleRow label="combobox">
        <Field label="Owner (free text)">
          {(id) => (
            <Combobox
              id={id}
              mode="free"
              listLabel="Owner suggestions"
              placeholder="Add owner"
              value={owner}
              onValueChange={setOwner}
              options={['Orders', 'Payments', 'Dispatch', 'Platform']}
            />
          )}
        </Field>
        <Field label="Kind (pick)">
          {(id) => (
            <Combobox
              id={id}
              mode="pick"
              listLabel="Kinds"
              value={kind}
              onValueChange={setKind}
              options={[
                { value: 'client', label: 'Client' },
                { value: 'service', label: 'Service' },
                { value: 'database', label: 'Database' },
              ]}
            />
          )}
        </Field>
        <Field label="Owner (mixed)">
          {(id) => (
            <Combobox
              id={id}
              mode="free"
              listLabel="Owner suggestions"
              placeholder="Mixed"
              value=""
              onValueChange={() => undefined}
              options={[]}
              className="placeholder:italic"
            />
          )}
        </Field>
      </SampleRow>
      <SampleRow label="select">
        <Field label="Protocol">
          {(id) => (
            <Select defaultValue="http">
              <SelectTrigger id={id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="grpc">gRPC</SelectItem>
                <SelectItem value="async">Async event</SelectItem>
                <SelectItem value="sql">SQL</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Protocol (disabled)">
          {(id) => (
            <Select defaultValue="http" disabled>
              <SelectTrigger id={id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </SampleRow>
      <SampleRow label="search field">
        <div className="w-60">
          <SearchField label="Search components" placeholder="Search components" />
        </div>
        <div className="w-72">
          <SearchField label="Search everything" placeholder="Search everything" shortcut="⌘K" />
        </div>
      </SampleRow>
      <SampleRow label="segmented">
        <SegmentedControl aria-label="Library layout" value={layout} onValueChange={setLayout}>
          <SegmentedControlItem value="grid" aria-label="Grid">
            <LayoutGrid />
          </SegmentedControlItem>
          <SegmentedControlItem value="list" aria-label="List">
            <List />
          </SegmentedControlItem>
        </SegmentedControl>
        <SegmentedControl aria-label="Export scope" value={scope} onValueChange={setScope}>
          <SegmentedControlItem value="deck">Whole deck</SegmentedControlItem>
          <SegmentedControlItem value="view">Current view</SegmentedControlItem>
          <SegmentedControlItem value="flow">Flow</SegmentedControlItem>
        </SegmentedControl>
      </SampleRow>
      <SampleRow label="switch">
        <div className="flex items-center gap-2">
          <Switch id={switchId} checked={notes} onCheckedChange={setNotes} />
          <label htmlFor={switchId} className="text-body">
            Include notes
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Switch aria-label="Off example" />
          <span className="text-body" aria-hidden>
            Off
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Switch aria-label="Disabled example" disabled defaultChecked />
          <span className="text-body text-ink-muted" aria-hidden>
            Disabled
          </span>
        </div>
      </SampleRow>
      <SampleRow label="checkbox">
        <Checkbox label="Clients" defaultChecked />
        <Checkbox label="Edge" />
        <Checkbox label="Some groups" checked="indeterminate" />
        <Checkbox label="Disabled" disabled />
      </SampleRow>
      <SampleRow label="radio group">
        <RadioGroup aria-label="Subtitle example" defaultValue="tech">
          <RadioGroupItem value="tech" label="Technology" />
          <RadioGroupItem value="host" label="Hosting" />
          <RadioGroupItem value="none" label="None" disabled />
        </RadioGroup>
      </SampleRow>
      <SampleRow label="swatch grid">
        <SwatchGrid
          label="Colours (checked)"
          options={SWATCH_SAMPLE}
          value={swatch}
          onSelect={setSwatch}
        />
        <SwatchGrid
          label="Colours (unchecked)"
          options={SWATCH_SAMPLE}
          value={null}
          onSelect={() => {}}
        />
      </SampleRow>
      <SampleRow label="colour area / hue slider">
        <div className="flex w-60 flex-col gap-2">
          <ColourArea
            hue={hsv.h}
            saturation={hsv.s}
            value={hsv.v}
            onChange={({ s, v }) => {
              setHsv((prev) => ({ ...prev, s, v }));
            }}
          />
          <HueSlider
            hue={hsv.h}
            onChange={(h) => {
              setHsv((prev) => ({ ...prev, h }));
            }}
          />
        </div>
      </SampleRow>
    </GallerySection>
  );
}
