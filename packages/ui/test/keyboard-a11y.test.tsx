import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from '../src/components/button';
import { Combobox } from '../src/components/combobox';
import { InlineEdit } from '../src/components/inline-edit';
import { Input } from '../src/components/input';
import { SearchField } from '../src/components/search-field';
import { SegmentedControl, SegmentedControlItem } from '../src/components/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../src/components/select';
import { Switch } from '../src/components/switch';
import { TagChip } from '../src/components/tag-chip';
import { TagInput } from '../src/components/tag-input';
import { Textarea } from '../src/components/textarea';
import { focusRing } from '../src/lib/focus';

/** One of every US1 control, in DOM order, each with an accessible name. */
function AllControls() {
  return (
    <div>
      <Button>Export</Button>
      <Button variant="chip" size="chip">
        REST
      </Button>
      <Button variant="toggle" pressed>
        Labels
      </Button>
      <Input aria-label="Owner" />
      <InlineEdit label="Deck name" value="Checkout" onCommit={() => undefined} />
      <Textarea aria-label="Description" />
      <Select defaultValue="http">
        <SelectTrigger aria-label="Protocol">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="http">HTTP</SelectItem>
        </SelectContent>
      </Select>
      <Combobox
        mode="free"
        label="Team"
        listLabel="Team suggestions"
        value=""
        onValueChange={() => undefined}
        options={['Orders']}
      />
      <TagInput label="Add tag" value={['pii']} onValueChange={() => undefined} />
      <TagChip
        label="critical"
        partial
        count="2/3"
        onActivate={() => undefined}
        activateLabel="Add critical to all"
        onRemove={() => undefined}
        removeLabel="Remove critical from all"
      />
      <SearchField label="Search" />
      <SegmentedControl aria-label="Layout" defaultValue="grid">
        <SegmentedControlItem value="grid">Grid</SegmentedControlItem>
        <SegmentedControlItem value="list">List</SegmentedControlItem>
      </SegmentedControl>
      <Switch aria-label="Include notes" />
    </div>
  );
}

const TAB_ORDER: [role: string, name: string][] = [
  ['button', 'Export'],
  ['button', 'REST'],
  ['button', 'Labels'],
  ['textbox', 'Owner'],
  ['textbox', 'Deck name'],
  ['textbox', 'Description'],
  ['combobox', 'Protocol'],
  ['combobox', 'Team'],
  ['button', 'Remove tag pii'],
  ['combobox', 'Add tag'],
  ['button', 'Add critical to all'],
  ['button', 'Remove critical from all'],
  ['searchbox', 'Search'],
  ['radio', 'Grid'], // roving focus: only the checked item is a tab stop
  ['switch', 'Include notes'],
];

const FOCUS_CLASSES = focusRing.split(' ');
const WRAPPER_FOCUS_CLASSES = [
  'focus-within:outline-2',
  'focus-within:outline-solid',
  'focus-within:outline-offset-2',
  'focus-within:outline-primary',
];

describe('keyboard access to the core controls (US2)', () => {
  it('reaches every control with Tab in DOM order', async () => {
    const user = userEvent.setup();
    render(<AllControls />);
    for (const [role, name] of TAB_ORDER) {
      await user.tab();
      expect(screen.getByRole(role, { name })).toHaveFocus();
    }
  });

  it('gives every control the shared visible focus style', () => {
    render(<AllControls />);
    for (const [role, name] of TAB_ORDER) {
      const element = screen.getByRole(role, { name });
      if (role === 'searchbox') {
        const wrapper = element.closest('[data-slot="search-field"]');
        expect(wrapper).toHaveClass(...WRAPPER_FOCUS_CLASSES);
      } else {
        expect(element).toHaveClass(...FOCUS_CLASSES);
      }
    }
  });

  it('gives every control a non-empty accessible name', () => {
    render(<AllControls />);
    for (const [role, name] of TAB_ORDER) {
      expect(screen.getByRole(role, { name })).toHaveAccessibleName(name);
    }
  });

  it('keeps focus-visible:outline-solid, without which Tailwind v4 draws no outline', () => {
    expect(FOCUS_CLASSES).toContain('focus-visible:outline-solid');
  });
});
