import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { playbackDeck } from '../../test/flow-fixtures';
import { announced, renderFlows } from '../../test/render-flows';
import { openFlow } from './flow-mode';
import { setGroupCollapsed, toggleGroupCollapsed } from '../views/use-current-view';

const groupedPlaybackDeck = {
  ...playbackDeck,
  nodes: playbackDeck.nodes.map((node) =>
    node.id === 'b' || node.id === 'c' ? { ...node, group: 'core' } : node,
  ),
  groups: [{ id: 'core', title: 'Core services' }],
};

function setup(flowId = 'order', stepId: string | null = null, deck = playbackDeck) {
  const view = renderFlows(deck);
  act(() => {
    openFlow(view.editor(), flowId, stepId);
  });
  return { ...view, player: screen.getByRole('region', { name: 'Step player' }) };
}

describe('StepPlayer', () => {
  it('disables Previous on step 1 and Next on the last step', async () => {
    const { player, user } = setup();
    expect(within(player).getByRole('button', { name: 'Previous step' })).toBeDisabled();
    expect(within(player).getByText('Place order · Step 1 of 8')).toBeInTheDocument();
    expect(within(player).getByText('Submit order')).toBeInTheDocument();
    await user.click(within(player).getByRole('button', { name: 'Next step' }));
    expect(within(player).getByText('Place order · Step 2 of 8')).toBeInTheDocument();
    expect(within(player).getByText('API Gateway → Order Service')).toBeInTheDocument();
    expect(announced()).toBe('Step 2 of 8: API Gateway → Order Service');
    await user.click(within(player).getByRole('button', { name: 'Go to step 8 of 8' }));
    expect(within(player).getByRole('button', { name: 'Next step' })).toBeDisabled();
  });

  it('sets how notes show during the flow from its Notes menu (§g-60)', async () => {
    const { player, user, ui } = setup();
    await user.click(within(player).getByRole('button', { name: 'Notes: dimmed' }));
    const menu = screen.getByRole('menu', { name: 'Notes during flows' });
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Hidden' }));
    expect(ui().notesDisplay).toBe('hidden');
  });

  it('lists a segment per played step; clicking one makes it current', async () => {
    const { player, user, ui } = setup();
    const progress = within(player).getByRole('list', { name: 'Progress' });
    const segments = within(progress).getAllByRole('button');
    expect(segments).toHaveLength(8);
    expect(segments[0]).toHaveAttribute('aria-current', 'step');
    await user.click(within(progress).getByRole('button', { name: 'Go to step 6 of 8' }));
    expect(ui().activeFlow?.stepId).toBe('o6');
    expect(within(progress).getByRole('button', { name: 'Go to step 6 of 8' })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('names broken and error-path segments', () => {
    setup('broken');
    expect(
      screen.getByRole('button', { name: 'Go to step 2 of 3, connection deleted' }),
    ).toBeInTheDocument();
  });

  it('shows "No steps" with every control disabled for an empty flow', () => {
    const { player } = setup('empty');
    expect(within(player).getByText('Refund · No steps')).toBeInTheDocument();
    for (const name of ['Previous step', 'Play', 'Next step', 'Speed 1×']) {
      expect(within(player).getByRole('button', { name })).toBeDisabled();
    }
    expect(within(player).queryByRole('list', { name: 'Progress' })).toBeNull();
  });

  it('is not shown outside flow mode', () => {
    renderFlows(playbackDeck);
    expect(screen.queryByRole('region', { name: 'Step player' })).toBeNull();
  });

  it('toggles Play and Pause with aria-pressed; Speed switches 1× ↔ 2× and pauses', async () => {
    const { player, user, ui } = setup();
    await user.click(within(player).getByRole('button', { name: 'Play' }));
    const pause = within(player).getByRole('button', { name: 'Pause' });
    expect(pause).toHaveAttribute('aria-pressed', 'true');
    await user.click(pause);
    expect(within(player).getByRole('button', { name: 'Play' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(within(player).getByRole('button', { name: 'Play' }));
    await user.click(within(player).getByRole('button', { name: 'Speed 1×' }));
    expect(ui().activeFlow).toMatchObject({ speed: 2, playing: false });
    await user.click(within(player).getByRole('button', { name: 'Speed 2×' }));
    expect(ui().activeFlow?.speed).toBe(1);
  });

  it('pauses on ← / → and on a step-row click', async () => {
    const { user, ui } = setup();
    const playing = () => {
      act(() => {
        ui().setPlaying(true);
      });
    };
    playing();
    await user.keyboard('{ArrowRight}');
    expect(ui().activeFlow).toMatchObject({ stepId: 'o2', playing: false });
    playing();
    await user.keyboard('{ArrowLeft}');
    expect(ui().activeFlow).toMatchObject({ stepId: 'o1', playing: false });
    playing();
    await user.click(screen.getByRole('button', { name: /^Step 5\b/ }));
    expect(ui().activeFlow).toMatchObject({ stepId: 'o5', playing: false });
  });

  it('reaches every control by Tab with a focus ring; Enter and Space activate them', async () => {
    const { player, user, ui } = setup('order', 'o2');
    within(player).getByRole('button', { name: 'Previous step' }).focus();
    const order = ['Previous step', 'Play', 'Next step', 'Speed 1×'];
    for (const name of order) {
      const button = within(player).getByRole('button', { name });
      expect(button).toHaveFocus();
      expect(button.className).toContain('focus-visible:outline');
      await user.tab();
    }
    within(player).getByRole('button', { name: 'Next step' }).focus();
    await user.keyboard('{Enter}');
    expect(ui().activeFlow?.stepId).toBe('o3');
    within(player).getByRole('button', { name: 'Previous step' }).focus();
    await user.keyboard(' ');
    expect(ui().activeFlow?.stepId).toBe('o2');
  });

  it('shows and removes the collapsed-group hint after the step title', () => {
    const { player, editor } = setup('order', 'o2', groupedPlaybackDeck);
    act(() => {
      toggleGroupCollapsed(editor(), 'core');
      openFlow(editor(), 'order', 'o2');
    });
    expect(within(player).getByText(/inside Core services/)).toBeInTheDocument();
    expect(announced()).toBe('Step 2 of 8: API Gateway → Order Service, inside Core services');

    act(() => {
      setGroupCollapsed(editor(), 'core', false);
    });
    expect(within(player).queryByText('inside Core services')).toBeNull();
  });

  describe('Deck look (035)', () => {
    it('marks the played, current and upcoming segments without colour', () => {
      const { player } = setup('order', 'o3');
      const segments = within(within(player).getByRole('list', { name: 'Progress' })).getAllByRole(
        'button',
      );
      expect(segments.map((s) => s.getAttribute('aria-current'))).toEqual([
        null,
        null,
        'step',
        null,
        null,
        null,
        null,
        null,
      ]);
      const state = (s: HTMLElement) => s.firstElementChild?.getAttribute('data-segment-state');
      expect(segments.map(state)).toEqual([
        'played',
        'played',
        'current',
        'upcoming',
        'upcoming',
        'upcoming',
        'upcoming',
        'upcoming',
      ]);
    });

    it('outlines the next branch point with data-next-fork', () => {
      const { player } = setup('fork', 'f1');
      const progress = within(player).getByRole('list', { name: 'Progress' });
      const marked = progress.querySelectorAll('[data-next-fork]');
      expect(marked).toHaveLength(1);
      expect(marked[0]?.closest('li')).toContainElement(
        within(progress).getByRole('button', { name: /Go to step 3 of/ }),
      );
    });

    it('drops the marker once the fork is reached', () => {
      const { player } = setup('fork', 'f3');
      expect(player.querySelector('[data-next-fork]')).toBeNull();
    });

    it('keeps every control named and focusable', () => {
      const { player } = setup('order', 'o2');
      for (const name of ['Previous step', 'Play', 'Next step', 'Speed 1×']) {
        expect(within(player).getByRole('button', { name })).toBeEnabled();
      }
    });

    it('fits 40 segments without growing past its panel', () => {
      const steps = Array.from({ length: 40 }, (_, i) => ({
        id: `m${String(i)}`,
        edge: i % 2 === 0 ? 'ab' : 'bc',
      }));
      const big = {
        ...playbackDeck,
        flows: [{ id: 'long', title: 'Long', feature: 'checkout', steps }],
      };
      const { player } = setup('long', null, big);
      const list = within(player).getByRole('list', { name: 'Progress' });
      expect(within(list).getAllByRole('button')).toHaveLength(40);
      // Segments shrink (min width, flex) and the list scrolls; the panel keeps its width class.
      expect(list.className).toContain('overflow-x-auto');
      expect(player.className).toContain('min(560px');
    });
  });
});
