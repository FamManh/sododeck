import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodeFormatTabs } from './code-format-tabs';

describe('CodeFormatTabs', () => {
  it('lists DBML and SQL, and no JSON, with the current one selected', () => {
    render(<CodeFormatTabs format="dbml" onChange={() => undefined} />);
    const list = screen.getByRole('tablist', { name: 'Code format' });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['DBML', 'SQL']);
    expect(screen.getByRole('tab', { name: 'DBML' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'SQL' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByRole('tab', { name: 'JSON' })).not.toBeInTheDocument();
  });

  it('changes format on click and with arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CodeFormatTabs format="dbml" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'SQL' }));
    expect(onChange).toHaveBeenLastCalledWith('sql');
    screen.getByRole('tab', { name: 'DBML' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('sql');
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('sql');
  });
});
