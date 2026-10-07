import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmbedHostPage } from './embed-host-page';

describe('EmbedHostPage (067 US6)', () => {
  it('shows the controls, the editor frame and the message log', () => {
    render(<EmbedHostPage />);
    expect(screen.getByTitle('Embedded editor')).toHaveAttribute('src', '/embed.html');
    expect(screen.getByLabelText('Sample deck')).toBeInTheDocument();
    expect(screen.getByLabelText('Deck file text')).toBeInTheDocument();
    for (const name of [
      'Send as outside change',
      'Simulate outside change',
      'Refuse next change',
      'Flush',
      'Reload editor',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    for (const name of [
      'Dark scheme',
      'Can open links',
      'Can save exported files',
      'Stores pictures',
    ]) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Protocol version')).toHaveValue(1);
    expect(screen.getByLabelText('Picture answers')).toBeInTheDocument();
    const log = screen.getByRole('table', { name: 'Message log' });
    expect(within(log).getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
  });
});
