import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodeFormatTabs } from './code-format-tabs';

describe('CodeFormatTabs', () => {
  it('lists JSON, DBML and SQL with the current one selected', () => {
    render(<CodeFormatTabs format="dbml" onChange={() => undefined} />);
    const list = screen.getByRole('tablist', { name: 'Code format' });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['JSON', 'DBML', 'SQL']);
    expect(screen.getByRole('tab', { name: 'DBML' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'JSON' })).toHaveAttribute('aria-selected', 'false');
  });

  it('changes format on click and with arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CodeFormatTabs format="json" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'SQL' }));
    expect(onChange).toHaveBeenLastCalledWith('sql');
    screen.getByRole('tab', { name: 'JSON' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('dbml');
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('sql');
  });
});
