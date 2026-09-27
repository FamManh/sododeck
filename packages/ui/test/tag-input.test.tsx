import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TagChip } from '../src/components/tag-chip';
import { TagInput } from '../src/components/tag-input';

function Harness({
  initial = [],
  spy,
}: {
  initial?: readonly string[];
  spy?: (tags: readonly string[]) => void;
}) {
  const [tags, setTags] = useState(initial);
  return (
    <TagInput
      label="Add tag"
      value={tags}
      onValueChange={(next) => {
        spy?.(next);
        setTags(next);
      }}
    />
  );
}

describe('TagInput', () => {
  it('adds "PII" once when Enter is pressed twice', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Add tag' }), 'PII{Enter}{Enter}');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('pii')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(['pii']);
  });

  it('clears the field after adding', async () => {
    render(<Harness />);
    const field = screen.getByRole('textbox', { name: 'Add tag' });
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
    expect(screen.getByRole('textbox', { name: 'Add tag' })).toHaveFocus();
  });

  it('removes a focused chip with Backspace', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['critical', 'pii']} />);
    screen.getByRole('button', { name: 'Remove tag critical' }).focus();
    await user.keyboard('{Backspace}');
    expect(screen.queryByText('critical')).not.toBeInTheDocument();
  });
});

describe('TagChip', () => {
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
