import { act, screen, within } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { resolveLook } from './style/card-style';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { DeckNode } from './deck-node';
import type { DeckFlowNode } from './deck-to-flow';

const connection = vi.hoisted(() => ({ role: null as string | null, connecting: false }));

vi.mock('./use-connection-role', () => ({
  useConnectionRole: () => connection.role,
  useConnecting: () => connection.connecting,
}));

const deck = deckOf({
  nodes: [
    { id: 'svc', type: 'service', title: 'Order Service' },
    { id: 'db', type: 'database', title: 'Orders DB' },
    { id: 'q', type: 'queue', title: 'Bus' },
  ],
  edges: [{ id: 'e1', from: 'svc', to: 'db' }],
});

function props(patch: Partial<DeckFlowNode['data']> = {}, selected = false, id = 'svc') {
  return {
    id,
    type: 'deck',
    selected,
    data: {
      title: 'Order Service',
      kind: 'service',
      subtitle: undefined,
      owner: undefined,
      tags: [],
      hasRules: false,
      childCount: 0,
      dimmed: false,
      level: 'component',
      focused: false,
      ...patch,
    },
  } as unknown as NodeProps<DeckFlowNode>;
}

function renderNode(p = props()) {
  return renderWithEditor(<DeckNode {...p} />, deck);
}

describe('DeckNode', () => {
  beforeEach(() => {
    connection.role = null;
    connection.connecting = false;
  });

  it('shows a problem glyph and says the count in its name (015 FR-022, FR-025)', () => {
    renderNode(
      props({ problems: { count: 2, titles: 'Duplicate connection', label: '2 problems' } }),
    );
    expect(
      screen.getByRole('group', { name: 'Service: Order Service, 2 problems' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('problem-glyph')).toHaveAttribute('title', 'Duplicate connection');
  });

  it('gives the corner to the connect "+" while it is a valid target', () => {
    connection.role = 'target:q';
    connection.connecting = true;
    renderNode(
      props({ problems: { count: 1, titles: 'Duplicate connection', label: '1 problem' } }),
    );
    expect(screen.queryByTestId('problem-glyph')).not.toBeInTheDocument();
  });

  it('is named by kind and title', () => {
    renderNode();
    const node = screen.getByRole('group', { name: 'Service: Order Service' });
    expect(node).toHaveAttribute('data-testid', 'deck-node');
    expect(node).toHaveAttribute('aria-selected', 'false');
    expect(node).toHaveAttribute('tabindex', '-1');
  });

  it('renders only the kind tile at Landscape level', () => {
    renderNode(props({ level: 'landscape' }));
    expect(screen.queryByText('Order Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Go')).not.toBeInTheDocument();
  });

  it('renders only the title at System level', () => {
    renderNode(props({ level: 'system' }));
    expect(screen.getByText('Order Service')).toBeInTheDocument();
    expect(screen.queryByText('Go')).not.toBeInTheDocument();
  });

  it('renders title and tech at Container level', () => {
    renderNode(props({ level: 'container', subtitle: 'Go' }));
    expect(screen.getByText('Order Service')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
  });

  it('reads like Container at Component level, at the same size: no owner or tags (§g-58)', () => {
    const { container } = renderNode(
      props({
        level: 'component',
        subtitle: 'Go',
        owner: 'Team Apollo',
        tags: ['critical'],
        hasRules: true,
      }),
    );
    expect(screen.getByText('Order Service')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
    expect(screen.queryByText('Team Apollo')).not.toBeInTheDocument();
    expect(screen.queryByText('critical')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Has rules' })).toBeInTheDocument();
    expect(container.querySelector('[data-testid="deck-node"]')).toHaveStyle({ height: '50px' });
  });

  it('clamps a resized card\u2019s title to the lines it can show, keeping the full text in the tooltip (017 R11, FR-008)', () => {
    const title = 'Order Fulfilment and Inventory Reconciliation Service';
    const p = {
      ...props({ level: 'component', title }),
      width: 200,
      height: 44,
    } as NodeProps<DeckFlowNode>;
    renderNode(p);
    const text = screen.getByText(title);
    expect(text).toHaveStyle({ WebkitLineClamp: '1' });
    expect(screen.getByRole('group')).toHaveAttribute('title', title);
  });

  it('shows a child-count marker for components with children', () => {
    renderNode(props({ childCount: 3 }));
    expect(
      screen.getByRole('img', { name: '3 components inside, press Enter to open' }),
    ).toHaveTextContent('3');
  });

  it('has four named connection handles', () => {
    renderNode();
    expect(screen.getAllByRole('button', { name: 'Connect from Order Service' })).toHaveLength(4);
  });

  it('shows its side targets, with the hot side marked, during a reconnect drag (017 R12)', () => {
    renderNode();
    act(() => {
      useUiStore.getState().setCanvasGesture('endpoint');
      useUiStore.getState().setEndpointHover({ nodeId: 'svc', side: 'right' });
    });
    const handles = screen.getAllByRole('button', { name: 'Connect from Order Service' });
    expect(handles.every((handle) => handle.hasAttribute('data-endpoint-target'))).toBe(true);
    expect(handles.filter((handle) => handle.hasAttribute('data-endpoint-hot'))).toHaveLength(1);
    act(() => {
      useUiStore.getState().setEndpointHover({ nodeId: 'other', side: 'right' });
    });
    expect(
      screen
        .getAllByRole('button', { name: 'Connect from Order Service' })
        .some((handle) => handle.hasAttribute('data-endpoint-target')),
    ).toBe(false);
  });

  it('shows selection and takes the Tab stop when focused', () => {
    renderNode(props({ focused: true }, true));
    const node = screen.getByTestId('deck-node');
    expect(node).toHaveAttribute('aria-selected', 'true');
    expect(node).toHaveAttribute('tabindex', '0');
  });

  it('marks the from/to of the current flow step with the ring and aria-current (007)', () => {
    renderNode(props({ currentStep: true }));
    const node = screen.getByTestId('deck-node');
    expect(node).toHaveAttribute('aria-current', 'step');
    expect(node).toHaveClass('ring-primary');
  });

  it('has no aria-current outside the current step', () => {
    renderNode();
    expect(screen.getByTestId('deck-node')).not.toHaveAttribute('aria-current');
  });

  it('truncates a long title but keeps it in the name and tooltip', () => {
    const title = 'A very long component title that does not fit into 164 pixels at all';
    renderNode(props({ title }));
    const node = screen.getByRole('group', { name: `Service: ${title}` });
    expect(node).toHaveAttribute('title', title);
  });

  it('keeps the same accessible name at every level', () => {
    for (const level of ['landscape', 'system', 'container', 'component'] as const) {
      const { unmount } = renderNode(props({ level, subtitle: 'Go', owner: 'Team', tags: ['t'] }));
      expect(screen.getByRole('group', { name: 'Service: Order Service' })).toBeInTheDocument();
      unmount();
    }
  });

  describe('views (011)', () => {
    it('shows the subtitle the view chose, from Container level up', () => {
      renderNode(props({ level: 'container', subtitle: '3 flows · Orders' }));
      expect(screen.getByText('3 flows · Orders')).toBeInTheDocument();
    });

    it.each(['system', 'landscape'] as const)('hides the subtitle at %s level', (level) => {
      renderNode(props({ level, subtitle: 'k8s' }));
      expect(screen.queryByText('k8s')).not.toBeInTheDocument();
    });

    it('names a dimmed component, which stays focusable', () => {
      renderNode(props({ viewDimmed: true, focused: true }));
      const node = screen.getByRole('group', {
        name: 'Service: Order Service, dimmed in this view',
      });
      expect(node).toHaveAttribute('tabindex', '0');
      expect(node).not.toHaveAttribute('aria-hidden');
      expect(node).not.toHaveAttribute('inert');
    });

    it.each(['system', 'container', 'component'] as const)(
      'shows a pin glyph at %s level and says "pinned"',
      (level) => {
        renderNode(props({ level, pinned: true }));
        expect(screen.getByRole('img', { name: 'Pinned' })).toBeInTheDocument();
        expect(
          screen.getByRole('group', { name: 'Service: Order Service, pinned' }),
        ).toBeInTheDocument();
      },
    );

    it('has no pin glyph at Landscape level, but keeps "pinned" in the name', () => {
      renderNode(props({ level: 'landscape', pinned: true }));
      expect(screen.queryByRole('img', { name: 'Pinned' })).not.toBeInTheDocument();
      expect(
        screen.getByRole('group', { name: 'Service: Order Service, pinned' }),
      ).toBeInTheDocument();
    });

    it('notes a component that the view hides but was created here', () => {
      renderNode(props({ hiddenInView: true }));
      expect(screen.getByRole('note')).toHaveTextContent('Hidden in this view');
    });
  });

  it('shows a valid drop target with a + mark', () => {
    connection.connecting = true;
    connection.role = 'target:q';
    renderNode();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByTestId('deck-node').querySelector('.lucide-plus')).not.toBeNull();
  });

  it('explains an invalid drop target: already connected', () => {
    connection.connecting = true;
    connection.role = 'target:db';
    renderNode();
    expect(screen.getByRole('note')).toHaveTextContent('Already connected');
    expect(useUiStore.getState().announcement.text).toBe('Already connected');
  });

  it("explains an invalid drop target: can't connect to itself", () => {
    connection.connecting = true;
    connection.role = 'target:svc';
    renderNode();
    expect(screen.getByRole('note')).toHaveTextContent("Can't connect to itself");
  });
});

describe('DeckNode flow start (006 FR-009)', () => {
  it('shows "Step n starts here" as text, not only a ring', () => {
    renderNode(props({ flowStart: 'Step 4 starts here' }));
    expect(screen.getByText('Step 4 starts here')).toBeInTheDocument();
  });
});

describe('DeckNode title edit (019 US1)', () => {
  it('shows the title field in the card while its title is edited, at every level', () => {
    for (const level of ['component', 'container', 'system', 'landscape'] as const) {
      const { unmount } = renderNode(props({ level }));
      act(() => {
        useUiStore.getState().startTitleEdit({ target: 'node', id: 'svc', isNew: false });
      });
      const card = screen.getByTestId('deck-node');
      const field = within(card).getByRole('textbox', { name: 'Component title' });
      expect(field).toHaveValue('Order Service');
      expect(field).toHaveFocus();
      expect(within(card).queryByText('Order Service', { selector: 'span' })).toBeNull();
      unmount();
    }
  });

  it('keeps the title text in other cards', () => {
    renderNode();
    act(() => {
      useUiStore.getState().startTitleEdit({ target: 'node', id: 'db', isNew: false });
    });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Order Service')).toBeInTheDocument();
  });
});

describe('DeckNode details button (019 US4)', () => {
  it('has a details button named after the card, except while its title is edited', () => {
    renderNode(props({ focused: true }));
    const button = screen.getByRole('button', { name: 'Open details for Order Service' });
    expect(button).toHaveAttribute('tabindex', '0');
    act(() => {
      useUiStore.getState().startTitleEdit({ target: 'node', id: 'svc', isNew: false });
    });
    expect(screen.queryByRole('button', { name: 'Open details for Order Service' })).toBeNull();
  });
});

describe('DeckNode colour (020 R5)', () => {
  it('extends the accessible description with "Green fill" for a named fill', () => {
    const look = resolveLook({ fill: 'green' });
    renderNode(props({ look }));
    expect(screen.getByRole('group')).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Green fill'),
    );
  });

  it('extends the accessible description with "Blue stroke" for a stroke', () => {
    const look = resolveLook({ stroke: 'blue' });
    renderNode(props({ look }));
    expect(screen.getByRole('group')).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Blue stroke'),
    );
  });

  it('uses the secondary text role for the subtitle on a named fill', () => {
    const look = resolveLook({ fill: 'green' });
    renderNode(props({ look, level: 'container', subtitle: 'orders.svc' }));
    expect(screen.getByText('orders.svc')).toHaveAttribute('data-text', 'secondary');
  });

  it('sets data-text="light" on the card for a hex fill resolving to light text', () => {
    const look = resolveLook({ fill: '#1c1c1a' });
    renderNode(props({ look }));
    expect(screen.getByTestId('deck-node')).toHaveAttribute('data-text', 'light');
  });
});

describe('DeckNode colour states (020 US6)', () => {
  it('keeps the flow-step border instead of a coloured stroke, badge and announcement (007)', () => {
    const look = resolveLook({ stroke: 'blue' });
    renderNode(props({ look, currentStep: true }));
    const node = screen.getByTestId('deck-node');
    expect(node).not.toHaveAttribute('data-stroke');
    expect(node).toHaveAttribute('aria-current', 'step');
  });

  it('shows the error ring marker and the alert badge, with a fill', () => {
    const look = resolveLook({ fill: 'green' });
    renderNode(
      props({ look, problems: { count: 1, titles: 'Duplicate connection', label: '1 problem' } }),
    );
    const node = screen.getByTestId('deck-node');
    expect(node).toHaveAttribute('data-problem', '');
    expect(screen.getByTestId('problem-glyph')).toBeInTheDocument();
  });

  it('shows the error ring marker and the alert badge, without a fill', () => {
    renderNode(
      props({ problems: { count: 1, titles: 'Duplicate connection', label: '1 problem' } }),
    );
    const node = screen.getByTestId('deck-node');
    expect(node).toHaveAttribute('data-problem', '');
    expect(screen.getByTestId('problem-glyph')).toBeInTheDocument();
  });

  it('keeps aria-selected and the "Selected" description on a selected coloured card', () => {
    const look = resolveLook({ fill: 'green' });
    renderNode(props({ look }, true));
    const node = screen.getByTestId('deck-node');
    expect(node).toHaveAttribute('aria-selected', 'true');
    expect(node).toHaveAttribute('aria-description', expect.stringContaining('Selected'));
  });
});
