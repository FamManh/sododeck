import { screen } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../state/ui-store';
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
      hasRules: false,
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

  it('is named by kind and title', () => {
    renderNode();
    const node = screen.getByRole('group', { name: 'Service: Order Service' });
    expect(node).toHaveAttribute('data-testid', 'deck-node');
    expect(node).toHaveAttribute('aria-selected', 'false');
    expect(node).toHaveAttribute('tabindex', '-1');
  });

  it('shows the subtitle only when tech is set', () => {
    renderNode(props({ subtitle: 'Go' }));
    expect(screen.getByText('Go')).toBeInTheDocument();
  });

  it('has no subtitle line without tech', () => {
    renderNode();
    const node = screen.getByTestId('deck-node');
    expect(node.textContent).toBe('Order Service');
  });

  it('marks nodes with rules', () => {
    renderNode(props({ hasRules: true }));
    expect(screen.getByRole('img', { name: 'Has rules' })).toBeInTheDocument();
  });

  it('has four named connection handles', () => {
    renderNode();
    expect(screen.getAllByRole('button', { name: 'Connect from Order Service' })).toHaveLength(4);
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
