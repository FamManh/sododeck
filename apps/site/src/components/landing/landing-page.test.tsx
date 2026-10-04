import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { APP_URL } from '../../site';
import { LandingPage } from './landing-page';

describe('LandingPage', () => {
  it('has one headline (A) and a heading per step', () => {
    render(<LandingPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Describe your system. Get a living map.' }),
    ).toBeInTheDocument();
    for (const title of [
      'See the whole system, then just the part you need',
      'Watch a flow run end to end',
      'Rules live where they apply',
      'The tables behind the map, on the same canvas',
      'One document, two views',
      'AI drafts it. You own it.',
      'Your decks stay on your machine',
      'Start with a prompt, or with a blank canvas.',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it('sends both "Start drawing" buttons to the app', () => {
    render(<LandingPage />);
    const starts = screen.getAllByRole('link', { name: 'Start drawing — no sign-up' });
    expect(starts).toHaveLength(2);
    for (const link of starts) expect(link).toHaveAttribute('href', APP_URL);
    expect(screen.getAllByRole('link', { name: 'Get the AI skill' })).toHaveLength(2);
  });

  it('describes every canvas visual in words', () => {
    render(<LandingPage />);
    const pictures = screen.getAllByRole('img');
    expect(pictures.length).toBeGreaterThan(10);
    for (const picture of pictures) expect(picture).toHaveAccessibleName();
  });

  it('shows the Database section with its three promises', () => {
    render(<LandingPage />);
    const section = document.getElementById('database');
    expect(section).not.toBeNull();
    if (section === null) return;
    for (const point of [
      'Draw tables, or import SQL and DBML.',
      'Flows show which tables each step touches.',
      'Export runnable SQL for your dialect.',
    ]) {
      expect(within(section).getByText(point)).toBeInTheDocument();
    }
  });

  it('defines the keyframes of every animated element in its stage', () => {
    const { container } = render(<LandingPage />);
    const stages = container.querySelectorAll<HTMLElement>('.sdl-stage');
    expect(stages.length).toBeGreaterThan(0);
    for (const stage of stages) {
      const css = [...stage.querySelectorAll('style')].map((s) => s.textContent).join('');
      for (const el of stage.querySelectorAll<HTMLElement>('.sdl-a')) {
        const name = el.style.getPropertyValue('--sdl-a').split(' ')[0] ?? '';
        expect(css).toContain(`@keyframes ${name}{`);
      }
    }
  });

  it('keeps Replay buttons hidden until the page script allows motion', () => {
    const { container } = render(<LandingPage />);
    const buttons = container.querySelectorAll('.sdl-replay');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button).not.toBeVisible();
    expect(screen.queryByRole('button', { name: 'Replay animation' })).toBeNull();
  });

  it('never loads anything from another site', () => {
    const { container } = render(<LandingPage />);
    const urls = [...container.querySelectorAll('[src], [href]')]
      .map((el) => el.getAttribute('src') ?? el.getAttribute('href') ?? '')
      .filter((url) => /^https?:/.test(url));
    expect(urls.every((url) => url === APP_URL)).toBe(true);
  });

  it('gives every Flows player real controls', () => {
    render(<LandingPage />);
    // Three breakpoint views; only one shows at a time.
    expect(screen.getAllByRole('button', { name: 'Previous step', hidden: true })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Next step', hidden: true })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Play', hidden: true })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Step 8', hidden: true })).toHaveLength(2);
  });

  it('switches the Database code panel between JSON, DBML and SQL, DBML first', () => {
    render(<LandingPage />);
    const desktop = document.getElementById('db-code-desktop-tab-1');
    expect(desktop).toHaveAttribute('aria-selected', 'true');
    expect(desktop).toHaveTextContent('DBML');
    expect(document.getElementById('db-code-desktop-panel-0')).not.toBeVisible();
    expect(document.getElementById('db-code-desktop-panel-2')).toHaveTextContent(
      'CREATE TABLE orders (',
    );
  });

  it('lets the Code section pick Order Service or Orders DB, Order Service first', () => {
    const { container } = render(<LandingPage />);
    const view = container.querySelector('#code [data-pick-root]');
    expect(view).not.toBeNull();
    if (view === null) return;
    expect(view.querySelector('[data-pick="svc"]')).toHaveAttribute('aria-pressed', 'true');
    expect(view.querySelector('[data-pick="odb"]')).toHaveAttribute('aria-pressed', 'false');
    expect(view.querySelectorAll('[data-ref="svc"][data-on]')).toHaveLength(7);
    expect(view.querySelectorAll('[data-ref="odb"]')).toHaveLength(5);
  });
});
