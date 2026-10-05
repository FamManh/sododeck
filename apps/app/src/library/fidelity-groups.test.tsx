import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FidelityGroups } from './fidelity-groups';

const rows = (texts: string[]) => (
  <ul>
    {texts.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

describe('FidelityGroups (062 FR-013, FR-015)', () => {
  it('shows the groups in a fixed order with counts and hides empty ones', () => {
    render(
      <FidelityGroups
        entries={[
          { group: 'not-supported', entry: 'line 9' },
          { group: 'left-out', entry: 'line 2' },
          { group: 'merged', entry: 'line 5' },
          { group: 'left-out', entry: 'line 3' },
        ]}
        renderGroup={rows}
      />,
    );
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toEqual(['Merged (1)', 'Left out (2)', 'Not supported (1)']);
    const leftOut = screen.getByRole('region', { name: 'Left out (2)' });
    expect(
      within(leftOut)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['line 2', 'line 3']);
  });

  it('says everything was imported when nothing was lost', () => {
    render(<FidelityGroups entries={[]} renderGroup={rows} />);
    expect(screen.getByText('Everything was imported.')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
