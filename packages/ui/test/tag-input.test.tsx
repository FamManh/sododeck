import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TagChip } from '../src/components/tag-chip';
import { TagInput } from '../src/components/tag-input';

function Harness({
  initial = [],
  spy,
  suggestions,
}: {
  initial?: readonly string[];
  spy?: (tags: readonly string[]) => void;
  suggestions?: readonly string[];
}) {
  const [tags, setTags] = useState(initial);
  return (
    <TagInput
      label="Add tag"
      suggestions={suggestions}
      value={tags}
      onValueChange={(next) => {
        spy?.(next);
        setTags(next);
      }}
    />
  );
}

describe('TagInput', () => {
  it('stops at max: a note replaces the add field', () => {
    render(<TagInput label="Add tag" value={['a', 'b']} max={2} onValueChange={() => {}} />);
    expect(screen.getByRole('note')).toHaveTextContent('2 tags max');
    expect(screen.queryByRole('combobox', { name: 'Add tag' })).not.toBeInTheDocument();
  });

  it('adds "PII" once when Enter is pressed twice', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.type(screen.getByRole('combobox', { name: 'Add tag' }), 'PII{Enter}{Enter}');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('pii')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(['pii']);
  });

  it('clears the field after adding', async () => {
    render(<Harness />);
    const field = screen.getByRole('combobox', { name: 'Add tag' });
    await userEvent.type(field, 'critical{Enter}');
    expect(field).toHaveValue('');
  });

  it('removes a tag with its remove button and moves focus to the next chip', async () => {
    render(<Harness initial={['critical', 'pii', 'public']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove tag pii' }));
    expect(screen.queryByText('pii')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove tag public' })).toHaveFocus();
  });

  it('moves focus to the add field after removing the last chip', async () => {
    render(<Harness initial={['pii']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove tag pii' }));
    expect(screen.getByRole('combobox', { name: 'Add tag' })).toHaveFocus();
  });

  it('removes a focused chip with Backspace', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['critical', 'pii']} />);
    screen.getByRole('button', { name: 'Remove tag critical' }).focus();
    await user.keyboard('{Backspace}');
    expect(screen.queryByText('critical')).not.toBeInTheDocument();
  });
});

describe('TagInput suggestions and keys (008 FR-005)', () => {
  it('lists the tags in a list named "Tags"', () => {
    render(<Harness initial={['pii', 'core']} />);
    expect(
      within(screen.getByRole('list', { name: 'Tags' })).getAllByRole('listitem'),
    ).toHaveLength(2);
  });

  it('suggests deck tags containing the typed text, without the ones already present', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['pci']} suggestions={['pci', 'pricing', 'public', 'core']} />);
    await user.type(screen.getByRole('combobox', { name: 'Add tag' }), 'p');
    const options = within(screen.getByRole('listbox', { name: 'Tag suggestions' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['pricing', 'public']);
  });

  it('adds a chosen suggestion at once and clears the field', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} suggestions={['pricing', 'public']} />);
    const field = screen.getByRole('combobox', { name: 'Add tag' });
    await user.type(field, 'pri');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(spy).toHaveBeenCalledExactlyOnceWith(['pricing']);
    expect(field).toHaveValue('');
  });

  it('removes the last tag with Backspace in the empty field', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['critical', 'pii']} />);
    const field = screen.getByRole('combobox', { name: 'Add tag' });
    field.focus();
    await user.keyboard('{Backspace}');
    expect(screen.queryByText('pii')).not.toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(field).toHaveFocus();
    await user.type(field, 'ab{Backspace}');
    expect(screen.getByText('critical')).toBeInTheDocument();
  });
});

describe('TagChip', () => {
  it('shows a partial tag dashed with its count and "add to all" / "remove from all" actions', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onRemove = vi.fn();
    render(
      <TagChip
        label="critical"
        partial
        count="2/3"
        onActivate={onActivate}
        activateLabel="Add critical to all"
        onRemove={onRemove}
        removeLabel="Remove critical from all"
      />,
    );
    const chip = screen.getByText('critical').closest('[data-slot="tag-chip"]');
    expect(chip).toHaveClass('border-dashed');
    expect(chip).toHaveTextContent('critical2/3');
    await user.click(screen.getByRole('button', { name: 'Add critical to all' }));
    expect(onActivate).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Remove critical from all' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('shows the full label as a title for long tags', () => {
    const label = 'a-very-long-tag-name-that-will-truncate';
    render(<TagChip label={label} />);
    expect(screen.getByText(label)).toHaveAttribute('title', label);
  });

  it('has no remove button when onRemove is missing', () => {
    render(<TagChip label="pii" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
