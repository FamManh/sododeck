import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../src/components/button';
import { Panel, PanelSection, PanelTitle } from '../src/components/panel';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../src/components/tooltip';
import { cn } from '../src/lib/utils';

describe('cn', () => {
  it('keeps custom font-size and color utilities side by side', () => {
    expect(cn('text-body text-ink')).toBe('text-body text-ink');
  });

  it('resolves conflicts within the same group', () => {
    expect(cn('text-body', 'text-caption')).toBe('text-caption');
    expect(cn('shadow-rest', 'shadow-float')).toBe('shadow-float');
  });

  it('knows the radius and shadow keys added in 000', () => {
    expect(cn('rounded-row', 'rounded-banner')).toBe('rounded-banner');
    expect(cn('rounded-segment', 'rounded-input')).toBe('rounded-input');
    expect(cn('shadow-rest', 'shadow-tour')).toBe('shadow-tour');
    expect(cn('shadow-hover', 'shadow-float')).toBe('shadow-float');
    expect(cn('text-code-md', 'text-body')).toBe('text-body');
  });
});

describe('Button', () => {
  it('renders the primary variant and handles clicks', async () => {
    let clicks = 0;
    render(
      <Button variant="primary" onClick={() => (clicks += 1)}>
        Export
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Export' });
    expect(button).toHaveAttribute('data-variant', 'primary');
    expect(button).toHaveClass('bg-primary', 'text-on-primary');
    await userEvent.click(button);
    expect(clicks).toBe(1);
  });

  it('renders the chip variant', () => {
    render(<Button variant="chip">REST</Button>);
    expect(screen.getByRole('button', { name: 'REST' })).toHaveAttribute('data-variant', 'chip');
  });

  it('exposes the toggle pressed state and shows a check icon only when pressed', () => {
    const { rerender } = render(
      <Button variant="toggle" pressed>
        Labels
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Labels' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.querySelector('svg')).not.toBeNull();

    rerender(
      <Button variant="toggle" pressed={false}>
        Labels
      </Button>,
    );
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.querySelector('svg')).toBeNull();
  });

  it('has no pressed state outside the toggle variant', () => {
    render(<Button variant="secondary">Share</Button>);
    expect(screen.getByRole('button', { name: 'Share' })).not.toHaveAttribute('aria-pressed');
  });

  it('activates with Space and Enter', async () => {
    const user = userEvent.setup();
    let clicks = 0;
    render(<Button onClick={() => (clicks += 1)}>Fit</Button>);
    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(clicks).toBe(2);
  });

  it('ignores clicks and keys when disabled', async () => {
    const user = userEvent.setup();
    let clicks = 0;
    render(
      <Button disabled onClick={() => (clicks += 1)}>
        Delete
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toBeDisabled();
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    expect(clicks).toBe(0);
  });

  describe('icon-only buttons', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('warn in development when they have no accessible name', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      render(
        <Button size="icon">
          <svg />
        </Button>,
      );
      expect(error).toHaveBeenCalledWith(expect.stringContaining('aria-label'));
    });

    it('are found by their aria-label and do not warn', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      render(
        <Button size="icon" aria-label="Settings">
          <svg />
        </Button>,
      );
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      expect(error).not.toHaveBeenCalled();
    });
  });

  it('renders as its child with asChild', () => {
    render(
      <Button asChild>
        <a href="/docs">Docs</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('data-slot', 'button');
  });
});

describe('Panel', () => {
  it('renders a titled section', () => {
    render(
      <Panel aria-label="Inspector">
        <PanelTitle>Order Service</PanelTitle>
        <PanelSection label="Details">body</PanelSection>
      </Panel>,
    );
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  it('shows content on keyboard focus', async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger>Fit view</TooltipTrigger>
          <TooltipContent>Zoom to fit</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    await userEvent.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Zoom to fit');
  });
});
