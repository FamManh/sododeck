import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Textarea } from '../src/components/textarea';

describe('Textarea', () => {
  it('is a labelled multi-line textbox', async () => {
    render(<Textarea aria-label="Description" />);
    const textarea = screen.getByRole('textbox', { name: 'Description' });
    expect(textarea.tagName).toBe('TEXTAREA');
    await userEvent.type(textarea, '# Notes{Enter}line 2');
    expect(textarea).toHaveValue('# Notes\nline 2');
  });
});
