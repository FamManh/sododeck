import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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
