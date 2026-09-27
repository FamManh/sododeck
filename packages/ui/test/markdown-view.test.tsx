import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownView } from '../src/components/markdown-view';

describe('MarkdownView', () => {
  it('renders paragraphs, bullets as a list and inline code', () => {
    const { container } = render(
      <MarkdownView text={'Returns a fee.\n\n- uses `Delivery tier`\n- caches'} />,
    );
    expect(screen.getByText('Returns a fee.').tagName).toBe('P');
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText('Delivery tier').tagName).toBe('CODE');
    expect(container.querySelectorAll('code')).toHaveLength(1);
  });

  it('renders bold and italic with nested emphasis', () => {
    render(
      <MarkdownView text={'**Owner** reviews *priority* notes and **bold *nested*** text.'} />,
    );
    expect(screen.getByText('Owner').tagName).toBe('STRONG');
    expect(screen.getByText('priority').tagName).toBe('EM');
    const nestedItalic = screen.getByText('nested');
    expect(nestedItalic.tagName).toBe('EM');
    expect(nestedItalic.parentElement?.tagName).toBe('STRONG');
  });

  it('shows HTML and scripts as literal text and creates no element for them', () => {
    const { container } = render(
      <MarkdownView
        text={'<b>x</b> <script>window.hacked = 1</script> <img src=x onerror=alert(1)>'}
      />,
    );
    expect(container.querySelector('b, script, img')).toBeNull();
    expect(container).toHaveTextContent('<b>x</b> <script>window.hacked = 1</script>');
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined();
  });

  it('shows "Nothing to preview." for empty text', () => {
    render(<MarkdownView text="   " />);
    expect(screen.getByText('Nothing to preview.')).toBeInTheDocument();
  });

  it('passes through a role and a name', () => {
    render(<MarkdownView text="Hi" role="region" aria-label="Description preview" />);
    expect(screen.getByRole('region', { name: 'Description preview' })).toHaveTextContent('Hi');
  });
});
