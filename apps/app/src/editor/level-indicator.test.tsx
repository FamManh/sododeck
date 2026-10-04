import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LevelIndicator } from './level-indicator';

describe('LevelIndicator', () => {
  it('shows the current level with four bars and zooms to a chosen level', async () => {
    const user = userEvent.setup();
    const zoomTo = vi.fn();
    render(<LevelIndicator level="system" scope={{ node: null, group: null }} onZoomTo={zoomTo} />);

    const trigger = screen.getByRole('button', { name: 'Level: System' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.getAllByTestId('level-bar')).toHaveLength(4);
    expect(
      screen.getAllByTestId('level-bar').filter((bar) => bar.hasAttribute('data-filled')),
    ).toHaveLength(2);

    await user.click(trigger);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Landscape' }));
    expect(zoomTo).toHaveBeenCalledWith(0.2);
    await user.click(trigger);
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitemradio', { name: 'System' }),
    );
    expect(zoomTo).toHaveBeenLastCalledWith(0.4);
    await user.click(trigger);
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitemradio', { name: 'Container' }),
    );
    expect(zoomTo).toHaveBeenLastCalledWith(1.0);
  });

  it('locks to Component while drilled into a node', async () => {
    const user = userEvent.setup();
    const zoomTo = vi.fn();
    render(
      <LevelIndicator
        level="landscape"
        scope={{ node: 'parent', group: null }}
        onZoomTo={zoomTo}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Level: Component' }));
    expect(screen.getByRole('menuitemradio', { name: 'Component' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Landscape' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Container' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(zoomTo).not.toHaveBeenCalled();
  });
});
