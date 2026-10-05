import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeverityIcon } from './severity-icon';

describe('SeverityIcon (047)', () => {
  it('names the severity', () => {
    render(
      <>
        <SeverityIcon severity="error" />
        <SeverityIcon severity="warning" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Error' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Warning' })).toBeInTheDocument();
  });

  it('takes a custom name', () => {
    render(<SeverityIcon severity="error" label="Type mismatch" />);
    expect(screen.getByRole('img', { name: 'Type mismatch' })).toBeInTheDocument();
  });
});
