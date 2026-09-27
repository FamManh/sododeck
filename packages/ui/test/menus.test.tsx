import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../src/components/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../src/components/dropdown-menu';

function DeckMenu({ onRename, onMove }: { onRename?: () => void; onMove?: (v: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="More actions">⋯</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onRename} shortcut="F2">
          Rename
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to folder</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value="payments" onValueChange={onMove}>
              <DropdownMenuRadioItem value="unfiled">Unfiled</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="payments">Payments</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive>Delete…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('opens a menu of items with shortcut hints and runs the chosen one', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<DeckMenu onRename={onRename} />);
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    expect(rename).toHaveTextContent('F2');
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toBeInTheDocument();
    await user.click(rename);
    expect(onRename).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the sub-menu with ArrowRight and shows the checked item', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<DeckMenu onMove={onMove} />);
    screen.getByRole('button', { name: 'More actions' }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    });
    await user.keyboard('{ArrowDown}{ArrowRight}');
    const checked = await screen.findByRole('menuitemradio', { name: 'Payments' });
    expect(checked).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Unfiled' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await user.click(screen.getByRole('menuitemradio', { name: 'Unfiled' }));
    expect(onMove).toHaveBeenCalledWith('unfiled');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<DeckMenu />);
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('ContextMenu', () => {
  it('opens on right-click', () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Card</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem shortcut="F2">Rename</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText('Card'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
  });
});
