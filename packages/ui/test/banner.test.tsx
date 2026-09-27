import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Banner } from '../src/components/banner';

describe('Banner', () => {
  it.each([
    ['warning', 'status'],
    ['success', 'status'],
    ['error', 'alert'],
  ] as const)('%s uses role %s and shows its icon', (tone, role) => {
    render(<Banner tone={tone}>Message</Banner>);
    const banner = screen.getByRole(role);
    expect(banner).toHaveAttribute('data-tone', tone);
    expect(banner.querySelector('svg')).not.toBeNull();
    expect(banner).toHaveTextContent('Message');
  });

  it('calls onDismiss from its Dismiss button', async () => {
    const onDismiss = vi.fn();
    render(
      <Banner tone="warning" onDismiss={onDismiss}>
        Back up your decks
      </Banner>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('has no Dismiss button without onDismiss', () => {
    render(<Banner tone="success">Saved</Banner>);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('renders an optional action', () => {
    render(
      <Banner tone="warning" action={<button type="button">Export now</button>}>
        Back up
      </Banner>,
    );
    expect(screen.getByRole('button', { name: 'Export now' })).toBeInTheDocument();
  });
});
