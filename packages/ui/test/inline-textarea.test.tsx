import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InlineTextarea } from '../src/components/inline-textarea';

describe('InlineTextarea', () => {
  it('is a labelled text box that wraps its text, one row by default', () => {
    render(<InlineTextarea aria-label="Note text" value="Remember retries" onChange={() => {}} />);
    const field = screen.getByRole('textbox', { name: 'Note text' });
    expect(field).toHaveValue('Remember retries');
    expect(field).toHaveAttribute('rows', '1');
  });

  it('takes its content height so it grows with the text', () => {
    const { rerender } = render(
      <InlineTextarea aria-label="Title" value="A" onChange={() => {}} />,
    );
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Title' });
    Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 54 });
    rerender(<InlineTextarea aria-label="Title" value={'A\nB\nC'} onChange={() => {}} />);
    expect(field.style.height).toBe('54px');
  });

  it('forwards its ref to the textarea', () => {
    let node: HTMLTextAreaElement | null = null;
    render(
      <InlineTextarea
        ref={(el) => {
          node = el;
        }}
        aria-label="Title"
        value=""
        onChange={() => {}}
      />,
    );
    expect(node).toBe(screen.getByRole('textbox', { name: 'Title' }));
  });
});
