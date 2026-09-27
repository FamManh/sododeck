/**
 * 006 accessibility pass (FR-040, constitution VII): every control has a name, and no state is
 * shown by color alone — error path, invalid, broken, chain break and filter matches all carry an
 * icon with a name or visible text.
 */
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { branchedDeck, flowDeck, playbackDeck } from '../../test/flow-fixtures';
import { announced, renderFlows } from '../../test/render-flows';
import { openFlow, play } from './flow-mode';
import { recordClick, startEditing, startNewFlow } from './flow-session';
import { useUiStore } from '../../state/ui-store';

const unnamed = (root: HTMLElement) =>
  within(root)
    .queryAllByRole('button')
    .concat(within(root).queryAllByRole('textbox'), within(root).queryAllByRole('switch'))
    .filter((el) => (el.getAttribute('aria-label') ?? el.textContent).trim() === '' && !el.id);

describe('flow authoring accessibility', () => {
  it('names every button, field and switch in the list, the session and the inspectors', () => {
    const { editor, ui } = renderFlows(branchedDeck);
    expect(unnamed(document.body)).toEqual([]);
    act(() => {
      startEditing(editor(), 'pay');
      ui().setActiveBranch('fail');
    });
    expect(unnamed(document.body)).toEqual([]);
    expect(screen.getByRole('switch', { name: 'Error path' })).toHaveAccessibleDescription(
      'Draws dashed with an error icon',
    );
  });

  it('shows states with text, not only color', async () => {
    const { editor, ui, user } = renderFlows({
      ...branchedDeck,
      flows: [
        ...branchedDeck.flows,
        {
          id: 'odd',
          title: 'Odd',
          steps: [
            { id: 'o1', edge: 'ab' },
            { id: 'o2', edge: 'cd' },
            { id: 'o3', edge: 'gone' },
          ],
        },
      ],
    });
    // Error path: header text and badge name.
    act(() => {
      ui().setActiveFlow('pay');
    });
    expect(screen.getByRole('button', { name: /payment failed, error path/ })).toHaveTextContent(
      'error path',
    );
    expect(screen.getByRole('button', { name: /^Step 3b \(error path\)/ })).toBeInTheDocument();
    // Chain break and broken step: icon plus text.
    act(() => {
      ui().setActiveFlow('odd');
    });
    expect(screen.getByText("Doesn't start where step 1 ended")).toBeInTheDocument();
    expect(screen.getByText('Connection deleted')).toBeInTheDocument();
    // Filter match: a <mark>, bold and underlined.
    await user.click(screen.getByRole('button', { name: 'Back to canvas' }));
    await user.type(screen.getByRole('searchbox', { name: 'Filter flows' }), 'odd');
    expect(screen.getByText('Odd', { selector: 'mark' })).toHaveClass('font-semibold', 'underline');
    // Invalid click: announced with the reason.
    await user.clear(screen.getByRole('searchbox', { name: 'Filter flows' }));
    act(() => {
      startNewFlow('X', null);
      recordClick(editor(), 'ab');
      recordClick(editor(), 'ab');
    });
    expect(announced()).toMatch(/^Can't add .* as step 2\. It doesn't start at API Gateway\.$/);
    expect(screen.getByText('Edge not added')).toBeInTheDocument();
  });

  it('announces every recording and editing event from the contract', () => {
    const { editor } = renderFlows(flowDeck);
    const heard: string[] = [];
    act(() => {
      startNewFlow('Place', null);
      heard.push(announced());
      recordClick(editor(), 'ab');
      heard.push(announced());
    });
    expect(heard).toEqual([
      'Recording ‘Place’. Click a connection to add step 1.',
      'Step 1 added: Customer App → API Gateway',
    ]);
  });
});

describe('flow playback accessibility (007 FR-023, FR-024)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Counts live-region updates while `run` executes. */
  async function announcements(run: () => unknown): Promise<string[]> {
    const texts: string[] = [];
    const stop = useUiStore.subscribe((s, prev) => {
      if (s.announcement.seq !== prev.announcement.seq) texts.push(s.announcement.text);
    });
    await run();
    stop();
    return texts;
  }

  it('announces every current-step change exactly once', async () => {
    const { editor, user } = renderFlows(playbackDeck);
    act(() => {
      openFlow(editor(), 'fork', 'f1');
    });
    const player = screen.getByRole('region', { name: 'Step player' });
    // Key.
    expect(await announcements(() => user.keyboard('{ArrowRight}'))).toEqual([
      'Step 2 of 5: API Gateway → Order Service',
    ]);
    // Step row.
    expect(
      await announcements(() => user.click(screen.getByRole('button', { name: /^Step 3\b/ }))),
    ).toHaveLength(1);
    // Segment.
    expect(
      await announcements(() =>
        user.click(within(player).getByRole('button', { name: 'Go to step 1 of 5' })),
      ),
    ).toHaveLength(1);
    // Branch switch.
    act(() => {
      openFlow(editor(), 'fork', 'f4a');
    });
    const picker = within(player).getByRole('radiogroup', { name: 'At step 3' });
    expect(
      await announcements(() =>
        user.click(within(picker).getByRole('radio', { name: 'payment failed, error path' })),
      ),
    ).toEqual(['Step 4b of 5: Payment Service → Notification Service, branch payment failed']);
    // Autoplay tick.
    vi.useFakeTimers();
    act(() => {
      openFlow(editor(), 'order', 'o1');
      play(editor());
    });
    expect(
      await announcements(() => {
        act(() => {
          vi.advanceTimersByTime(1700);
        });
      }),
    ).toEqual(['Step 2 of 8: API Gateway → Order Service']);
  });

  it('shows the current step and error path with text, not only color', () => {
    const { editor } = renderFlows(playbackDeck);
    act(() => {
      openFlow(editor(), 'fork', 'f4b');
    });
    const current = screen
      .getAllByRole('button', { name: /^Step / })
      .filter((b) => b.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    const player = screen.getByRole('region', { name: 'Step player' });
    expect(within(player).getByText('Checkout · Step 4b of 5')).toBeInTheDocument();
    const segment = within(player).getByRole('button', { name: 'Go to step 4b of 5, error path' });
    expect(segment).toHaveAttribute('aria-current', 'step');
    expect(within(player).getByRole('radio', { name: 'payment failed, error path' })).toBeChecked();
    expect(unnamed(document.body)).toEqual([]);
  });
});
