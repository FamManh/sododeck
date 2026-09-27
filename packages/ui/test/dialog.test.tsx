import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from '../src/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../src/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../src/components/select';

function ExportDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Export</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export deck</DialogTitle>
          <DialogDescription>Choose a format.</DialogDescription>
        </DialogHeader>
        <Select defaultValue="json">
          <SelectTrigger aria-label="Format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="png">PNG</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button variant="primary">Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('opens a named dialog and traps Tab inside it', async () => {
    const user = userEvent.setup();
    render(<ExportDialog />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export deck' });
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<ExportDialog />);
    const trigger = screen.getByRole('button', { name: 'Export' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes with DialogClose', async () => {
    const user = userEvent.setup();
    render(<ExportDialog />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has a Close icon button', async () => {
    const user = userEvent.setup();
    render(<ExportDialog />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes only the topmost layer on Escape', async () => {
    const user = userEvent.setup();
    render(<ExportDialog />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    screen.getByRole('combobox', { name: 'Format' }).focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Export deck' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
