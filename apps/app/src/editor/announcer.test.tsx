import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { Announcer } from './announcer';

const initial = useUiStore.getState();

describe('Announcer', () => {
  beforeEach(() => {
    useUiStore.setState(initial, true);
  });

  it('renders announcements in a polite status region', () => {
    render(<Announcer />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    act(() => {
      useUiStore.getState().announce('Added New service');
    });
    expect(region.textContent.replace('\u200b', '')).toBe('Added New service');
  });

  it('changes the text for a repeated message so it is announced again', () => {
    render(<Announcer />);
    act(() => {
      useUiStore.getState().announce('Undone');
    });
    const first = screen.getByRole('status').textContent;
    act(() => {
      useUiStore.getState().announce('Undone');
    });
    expect(screen.getByRole('status').textContent).not.toBe(first);
  });
});
