import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '../src/components/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../src/components/popover';

function WithTrigger({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button>Edit connection</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Connection">
          <label>
            Label
            <input />
          </label>
        </PopoverContent>
      </Popover>
      <button type="button">Outside</button>
    </>
  );
}

function Anchored({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <button type="button">Anchor</button>
      </PopoverAnchor>
      <PopoverContent aria-label="Connect to">
        <input aria-label="Find" />
      </PopoverContent>
    </Popover>
  );
}

describe('Popover', () => {
  it('opens and closes through the trigger, controlled by open / onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<WithTrigger onOpenChange={onOpenChange} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit connection' }));
    expect(screen.getByRole('dialog', { name: 'Connection' })).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Edit connection' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('moves focus into the content and back to the trigger on Escape', async () => {
    const user = userEvent.setup();
    render(<WithTrigger />);
    const trigger = screen.getByRole('button', { name: 'Edit connection' });
    await user.click(trigger);
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    const user = userEvent.setup();
    render(<WithTrigger />);
    await user.click(screen.getByRole('button', { name: 'Edit connection' }));
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('can be anchored to an element that is not a trigger', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Anchored open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('dialog', { name: 'Connect to' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Find' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(<Anchored open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
