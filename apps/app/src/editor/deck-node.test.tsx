import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { Profiler } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore, type EndpointPreview } from '../state/ui-store';
import { resolveLook } from './style/card-style';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { EMPTY_FIELD_VIEW, fieldBlock, type CardFieldView } from './card-fields';
import { cardLayout, type CardLayout } from './card-layout';
import { cardLayoutOf } from './canvas-geometry';
import { DeckNode } from './deck-node';
import { tableContextOf } from './table-keys';
import { toJSON as deckFile } from '@sododeck/model';
import { tagColours } from './tags/tag-colours';
import type { DeckFlowNode } from './deck-to-flow';

/** A connector end dragged over a card (050 R3): the end preview the hot side follows. */
const endOver = (targetId: string, side: 'left' | 'right'): EndpointPreview => ({
  edgeId: 'e1',
  end: 'target',
  targetId,
  targetKind: 'node',
  box: { x: 0, y: 0, width: 240, height: 128 },
  side,
  at: 0.4,
  point: { x: 0, y: 51 },
  snapped: false,
  automatic: false,
  valid: 'ok',
});

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

/** Test shorthand: `tags` become uncoloured (slate) `tagLooks`, as `toFlowNodes` makes them. */
type PropsPatch = Partial<DeckFlowNode['data']> & { tags?: readonly string[] };

function props(patch: PropsPatch = {}, selected = false, id = 'svc', layout?: CardLayout) {
  const { tags = [], ...rest } = patch;
  const data = {
    title: 'Order Service',
    kind: 'service',
    subtitle: undefined,
    owner: undefined,
    tagLooks: tags.map((text) => ({ text, ...tagColours(undefined) })),
    fields: EMPTY_FIELD_VIEW,
    hasRules: false,
    childCount: 0,
    dimmed: false,
    level: 'component',
    focused: false,
    ...rest,
  };
  return {
    id,
    type: 'deck',
    selected,
    data: {
      ...data,
      // What deck-to-flow computes (029): the same pure layout the card draws from.
      layout:
        layout ??
        cardLayout({
          title: data.title,
          description: data.subtitle,
          tags: data.tagLooks.map((look) => look.text),
          childCount: data.childCount,
          fieldsHeight: fieldBlock(data.fields, 184).height,
        }),
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

  it('does not re-render while the canvas pans or zooms (2026-10-02 perf)', () => {
    const onRender = vi.fn();
    renderWithEditor(
      <Profiler id="card" onRender={onRender}>
        <DeckNode {...props()} />
      </Profiler>,
      deck,
    );
    onRender.mockClear();
    act(() => {
      useUiStore.getState().setCanvasGesture('pan');
    });
    act(() => {
      useUiStore.getState().setCanvasGesture('drag');
    });
    act(() => {
      useUiStore.getState().setCanvasGesture(null);
    });
    expect(onRender).not.toHaveBeenCalled();
  });

  it('shows a problem glyph and says the count in its name (015 FR-022, FR-025)', () => {
    renderNode(
      props({
        problems: {
          count: 2,
          titles: 'Duplicate connection',
          label: '2 problems',
          severity: 'warning',
          rows: new Map(),
          rowText: new Map(),
        },
      }),
    );
    expect(
      screen.getByRole('group', { name: 'Service: Order Service, 2 problems' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('problem-glyph')).toHaveAttribute('title', 'Duplicate connection');
  });

  it('colours the badge and outline by the worst severity (047)', () => {
    const mark = (severity: 'error' | 'warning') => ({
      count: 1,
      titles: 'Type mismatch',
      label: '1 problem',
      severity,
      rows: new Map(),
      rowText: new Map(),
    });
    const { unmount } = renderNode(props({ problems: mark('error') }));
    expect(screen.getByTestId('problem-glyph')).toHaveAttribute('data-severity', 'error');
    expect(screen.getByTestId('problem-outline')).toHaveClass('border-clay-ink');
    unmount();
    renderNode(props({ problems: mark('warning') }));
    expect(screen.getByTestId('problem-glyph')).toHaveAttribute('data-severity', 'warning');
    expect(screen.getByTestId('problem-outline')).toHaveClass('border-amber-ink');
  });

  it('puts the problem badge in the header, not on the corner (029 US2)', () => {
    renderNode(
      props({
        problems: {
          count: 2,
          titles: 'Duplicate connection',
          label: '2 problems',
          severity: 'warning',
          rows: new Map(),
          rowText: new Map(),
        },
      }),
    );
    const badge = screen.getByTestId('problem-glyph');
    expect(screen.getByTestId('card-header')).toContainElement(badge);
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge).toHaveTextContent('2');
    expect(screen.getByTestId('deck-node')).toHaveAttribute(
      'aria-description',
      'Duplicate connection',
    );
  });

  it('draws the selection and the problem outline together', () => {
    renderNode(
      props(
        {
          problems: {
            count: 1,
            titles: 'Duplicate connection',
            label: '1 problem',
            severity: 'warning',
            rows: new Map(),
            rowText: new Map(),
          },
        },
        true,
      ),
    );
    const node = screen.getByTestId('deck-node');
    expect(node).toHaveClass('selected', 'has-problem');
    expect(screen.getByTestId('problem-outline')).toBeInTheDocument();
  });

  it('has no problem outline without a problem', () => {
    renderNode(props({}, true));
    expect(screen.queryByTestId('problem-outline')).not.toBeInTheDocument();
  });

  describe('database card face (049)', () => {
    const dbProps = (patch: PropsPatch) =>
      props({ title: 'Orders DB', kind: 'database', childCount: 1, ...patch }, false, 'db');

    it.each([
      [12, '12 tables inside'],
      [1, '1 table inside'],
      [0, 'No tables yet'],
    ])('shows %i tables as "%s" with the dialect chip', (count, text) => {
      renderNode(dbProps({ database: { count, dialect: 'Postgres' } }));
      const row = screen.getByRole('img', { name: `${text}, Postgres, press Enter to open` });
      expect(row).toHaveTextContent(text);
      expect(within(row).getByTestId('dialect-chip')).toHaveTextContent('Postgres');
      expect(screen.queryByText(/components inside/)).toBeNull();
    });

    it('shows the step chip with its verb and says it in the card name', () => {
      renderNode(
        dbProps({
          database: {
            count: 2,
            dialect: 'Generic',
          },
          touchChip: {
            text: 'writes orders +1',
            access: 'write',
            tables: [
              { title: 'orders', access: 'write' },
              { title: 'items', access: 'read' },
            ],
          },
        }),
      );
      expect(screen.getByTestId('touch-chip')).toHaveTextContent('writes orders +1');
      expect(
        screen.getByRole('group', { name: 'Database: Orders DB, current step writes orders +1' }),
      ).toBeInTheDocument();
    });

    it('draws no face on other cards', () => {
      renderNode();
      expect(screen.queryByTestId('dialect-chip')).toBeNull();
      expect(screen.queryByTestId('touch-chip')).toBeNull();
    });
  });

  it('reads "n inside" in the last row, keeping its label', () => {
    renderNode(props({ childCount: 4 }));
    const pill = screen.getByRole('img', { name: '4 components inside, press Enter to open' });
    expect(pill).toHaveTextContent('4 inside');
  });

  it('marks a valid connect target, and the hovered side handle as active', () => {
    connection.connecting = true;
    connection.role = 'target:q';
    renderNode();
    act(() => {
      useUiStore.getState().setCanvasGesture('endpoint');
      useUiStore.getState().setEndpointPreview(endOver('svc', 'left'));
    });
    expect(screen.getByTestId('deck-node')).toHaveClass('connect-target');
    const handles = screen.getAllByRole('button', { name: 'Connect from Order Service' });
    expect(handles.filter((h) => h.classList.contains('is-active'))).toHaveLength(1);
    expect(handles.find((h) => h.classList.contains('is-active'))).toHaveClass(
      'react-flow__handle-left',
    );
  });

  it('gives the corner to the connect "+" while it is a valid target', () => {
    connection.role = 'target:q';
    connection.connecting = true;
    renderNode(
      props({
        problems: {
          count: 1,
          titles: 'Duplicate connection',
          label: '1 problem',
          severity: 'warning',
          rows: new Map(),
          rowText: new Map(),
        },
      }),
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

  it('reads like Container at Component level: no owner row (§g-58)', () => {
    renderNode(
      props({
        level: 'component',
        subtitle: 'Go',
        owner: 'Team Apollo',
        hasRules: true,
      }),
    );
    expect(screen.getByText('Order Service')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
    expect(screen.queryByText('Team Apollo')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Has rules' })).toBeInTheDocument();
  });

  it('shows up to ten tags under the title, at every level but Landscape (2026-10-03)', () => {
    const tags = Array.from({ length: 12 }, (_, i) => `tag ${String(i + 1)}`);
    const { unmount } = renderNode(props({ level: 'container', tags }));
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(tags.slice(0, 10));
    unmount();
    renderNode(props({ level: 'landscape', tags }));
    expect(screen.queryByRole('list', { name: 'Tags' })).not.toBeInTheDocument();
  });

  it('clamps a resized card\u2019s title to the lines it can show, with the full text in a tooltip (017 R11, FR-008)', async () => {
    const title = 'Order Fulfilment and Inventory Reconciliation Service';
    const small = cardLayout({ title, size: { width: 200, height: 4 } });
    expect(small.titleLines).toBe(1);
    const p = {
      ...props({ level: 'component', title }, false, 'svc', small),
      width: 200,
      height: small.height,
    } as NodeProps<DeckFlowNode>;
    renderNode(p);
    const text = screen.getByText(title);
    expect(text).toHaveStyle({ WebkitLineClamp: '1' });
    await userEvent.hover(text);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(title);
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

  it('shows its side targets, with the hot side marked, during a connector end drag (017 R12, 050 R3)', () => {
    renderNode();
    act(() => {
      useUiStore.getState().setCanvasGesture('endpoint');
      useUiStore.getState().setEndpointPreview(endOver('svc', 'right'));
    });
    const handles = screen.getAllByRole('button', { name: 'Connect from Order Service' });
    expect(handles.every((handle) => handle.hasAttribute('data-endpoint-target'))).toBe(true);
    expect(handles.filter((handle) => handle.hasAttribute('data-endpoint-hot'))).toHaveLength(1);
    act(() => {
      useUiStore.getState().setEndpointPreview(endOver('other', 'right'));
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

  it('marks the from/to of the current flow step with the lift and aria-current (007)', () => {
    renderNode(props({ currentStep: true }));
    const node = screen.getByTestId('deck-node');
    expect(node).toHaveAttribute('aria-current', 'step');
    expect(node).toHaveClass('current-step');
  });

  it('has no aria-current outside the current step', () => {
    renderNode();
    expect(screen.getByTestId('deck-node')).not.toHaveAttribute('aria-current');
  });

  it('keeps a long title in the accessible name and shows it in a tooltip when cut', async () => {
    const title = Array.from({ length: 30 }, (_, i) => `component${String(i)}`).join(' ');
    renderNode(props({ title }));
    expect(screen.getByRole('group', { name: `Service: ${title}` })).not.toHaveAttribute('title');
    await userEvent.hover(screen.getByText(title));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(title);
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
      props({
        look,
        problems: {
          count: 1,
          titles: 'Duplicate connection',
          label: '1 problem',
          severity: 'warning',
          rows: new Map(),
          rowText: new Map(),
        },
      }),
    );
    const node = screen.getByTestId('deck-node');
    expect(node).toHaveAttribute('data-problem', '');
    expect(screen.getByTestId('problem-glyph')).toBeInTheDocument();
  });

  it('shows the error ring marker and the alert badge, without a fill', () => {
    renderNode(
      props({
        problems: {
          count: 1,
          titles: 'Duplicate connection',
          label: '1 problem',
          severity: 'warning',
          rows: new Map(),
          rowText: new Map(),
        },
      }),
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

describe('DeckNode per level (029 US4, R8)', () => {
  const LEVELS = ['landscape', 'system', 'container', 'component'] as const;

  it('keeps the same width and height at every level', () => {
    const sizes = LEVELS.map((level) => {
      const { unmount } = renderNode(
        props({ level, subtitle: 'Go', tags: ['a', 'b'], title: 'Order Service' }),
      );
      const node = screen.getByTestId('deck-node');
      const size = [node.style.width, node.style.height];
      unmount();
      return size;
    });
    for (const size of sizes) expect(size).toEqual(sizes[0]);
  });

  it('paints tile, title and tag dots at System, without the type name or description', () => {
    renderNode(props({ level: 'system', subtitle: 'Go', tags: ['critical', 'pci'] }));
    expect(screen.getByText('Order Service')).toBeInTheDocument();
    expect(screen.getByTestId('card-header')).toBeInTheDocument();
    expect(screen.queryByText('Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Go')).not.toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Tags' })).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(['critical', 'pci']);
    for (const item of items) expect(item).toBeEmptyDOMElement();
  });

  it("paints each tag pill in the tag's own colour, not the card's (033)", () => {
    const violet = tagColours('violet');
    renderNode(
      props({
        level: 'container',
        look: resolveLook({ fill: 'green' }),
        tagLooks: [
          { text: 'PCI', ...violet },
          { text: 'plain', ...tagColours(undefined) },
        ],
      }),
    );
    const [pci, plain] = within(screen.getByRole('list', { name: 'Tags' })).getAllByRole(
      'listitem',
    );
    expect(pci).toHaveTextContent('PCI');
    expect(pci).toHaveStyle({ '--tag-chip': violet.chip, '--tag-ink': violet.ink });
    expect(plain).toHaveTextContent('plain');
    expect(plain).toHaveStyle({
      '--tag-chip': 'var(--color-card-slate-chip)',
      '--tag-ink': 'var(--color-card-slate-ink)',
    });
  });

  it('paints named dots in the tag colour at System (033)', () => {
    const violet = tagColours('violet');
    renderNode(props({ level: 'system', tagLooks: [{ text: 'PCI', ...violet }] }));
    const dot = screen.getByRole('listitem', { name: 'PCI' });
    expect(dot).toBeEmptyDOMElement();
    expect(dot).toHaveStyle({ '--tag-dot': violet.dot });
  });

  it('paints only the type icon on the card fill at Landscape', () => {
    renderNode(props({ level: 'landscape', subtitle: 'Go', tags: ['a'] }));
    expect(screen.queryByTestId('card-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-description')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Tags' })).not.toBeInTheDocument();
    expect(screen.getByTestId('card-plate-icon')).toBeInTheDocument();
    expect(screen.queryByText('Order Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Go')).not.toBeInTheDocument();
    expect(screen.queryByText('Service')).not.toBeInTheDocument();
  });

  describe('card icon (038)', () => {
    it('draws the custom icon in the header tile and keeps the type name', () => {
      renderNode(props({ level: 'component', icon: 'lucide:search' }));
      const header = screen.getByTestId('card-header');
      expect(header.querySelector('[data-icon="lucide:search"]')).not.toBeNull();
      expect(within(header).getByText('Service')).toBeInTheDocument();
    });

    it('draws the type icon without a custom one, or with one it cannot show', () => {
      const { unmount } = renderNode(props({ level: 'component' }));
      expect(
        screen.getByTestId('card-header').querySelector('[data-icon="lucide:box"]'),
      ).not.toBeNull();
      unmount();
      renderNode(props({ level: 'component', icon: 'simple:kafka' }));
      expect(
        screen.getByTestId('card-header').querySelector('[data-icon="lucide:box"]'),
      ).not.toBeNull();
    });

    it('draws it on the Landscape plate and keeps the ink class', () => {
      renderNode(props({ level: 'landscape', icon: 'lucide:search' }));
      const plate = screen.getByTestId('card-plate-icon');
      expect(plate).toHaveAttribute('data-icon', 'lucide:search');
      expect(plate.getAttribute('class')).toContain('--card-ink');
    });
  });

  it('paints the type name, description and tag pills at Container and Component', () => {
    for (const level of ['container', 'component'] as const) {
      const { unmount } = renderNode(props({ level, subtitle: 'Go', tags: ['critical'] }));
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Go')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('DeckNode Deck look (029 US1)', () => {
  beforeEach(() => {
    connection.role = null;
    connection.connecting = false;
  });

  it('shows the type name in the header, next to the tile', () => {
    renderNode(props({ kind: 'database', title: 'Orders DB' }));
    const header = screen.getByTestId('card-header');
    expect(within(header).getByText('Database')).toBeInTheDocument();
  });

  it('clamps a long title to three lines and shows no tooltip for a short one', () => {
    const title = Array.from({ length: 40 }, (_, i) => `word${String(i)}`).join(' ');
    const { unmount } = renderNode(props({ title }));
    expect(screen.getByText(title)).toHaveStyle({ WebkitLineClamp: '3' });
    unmount();
    renderNode(props({ title: 'Short' }));
    expect(screen.getByText('Short')).toHaveStyle({ WebkitLineClamp: '1' });
  });

  it('shows the description clamped to three lines, and nothing when it is empty', () => {
    const description = Array.from({ length: 60 }, (_, i) => `detail${String(i)}`).join(' ');
    const { unmount } = renderNode(props({ subtitle: description }));
    expect(screen.getByText(description)).toHaveStyle({ WebkitLineClamp: '3' });
    unmount();
    renderNode(props({ subtitle: '   ' }));
    expect(screen.queryByTestId('card-description')).not.toBeInTheDocument();
  });

  it('lists tags as pills in a "Tags" list', () => {
    renderNode(props({ tags: ['payments', 'critical'] }));
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((i) => i.textContent),
    ).toEqual(['payments', 'critical']);
  });

  it('draws no description or tag elements for a card with neither', () => {
    renderNode(props({ subtitle: undefined, tags: [] }));
    expect(screen.queryByTestId('card-description')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Tags' })).not.toBeInTheDocument();
  });

  it('keeps its group role, label and description', () => {
    renderNode(props({}, true));
    const node = screen.getByRole('group', { name: 'Service: Order Service' });
    expect(node).toHaveAttribute('aria-roledescription', 'component');
    expect(node).toHaveAttribute('aria-description', 'Selected');
  });

  it('takes the card chip and ink colours from the look', () => {
    renderNode(props({ look: resolveLook({ fill: 'green' }) }));
    const node = screen.getByTestId('deck-node');
    expect(node.style.getPropertyValue('--card-chip')).toBe('var(--color-card-green-chip)');
    expect(node.style.getPropertyValue('--card-ink')).toBe('var(--color-card-green-ink)');
  });

  describe('step sticker (035)', () => {
    it('mounts a sticker only for a marked card, with its state', () => {
      renderNode(props({ step: { state: 'upcoming', number: '4' } }));
      const sticker = screen.getByTestId('step-sticker');
      expect(sticker).toHaveAttribute('data-step-state', 'upcoming');
      expect(sticker).toHaveTextContent('4');
      expect(screen.getByTestId('deck-node')).toHaveAttribute('data-step-state', 'upcoming');
    });

    it('has no sticker and no step state outside flow mode', () => {
      renderNode(props());
      expect(screen.queryByTestId('step-sticker')).not.toBeInTheDocument();
      expect(screen.getByTestId('deck-node')).not.toHaveAttribute('data-step-state');
    });

    it('marks only the current card with aria-current, and keeps its name', () => {
      const { unmount } = renderNode(props({ step: { state: 'played', number: null } }));
      expect(screen.getByTestId('deck-node')).not.toHaveAttribute('aria-current');
      unmount();
      renderNode(props({ currentStep: true, step: { state: 'current', number: '2' } }));
      const node = screen.getByTestId('deck-node');
      expect(node).toHaveAttribute('aria-current', 'step');
      expect(node).toHaveAttribute('aria-label', 'Service: Order Service');
    });

    it('does not change the card box (029 FR-016)', () => {
      const { unmount } = renderNode(props());
      const plain = screen.getByTestId('deck-node').getAttribute('style');
      unmount();
      renderNode(props({ step: { state: 'current', number: '2' } }));
      expect(screen.getByTestId('deck-node').getAttribute('style')).toBe(plain);
    });
  });
});

describe('DeckNode card types (030)', () => {
  it.each([
    ['component', 'Component'],
    ['task', 'Task'],
    ['decision', 'Decision'],
    ['document', 'Document'],
    ['warehouse', 'Warehouse'],
    ['truck-route', 'Truck route'],
    ['issue', 'Issue'],
  ])('names a %s card by its type', (kind, name) => {
    renderWithEditor(<DeckNode {...props({ kind, title: 'Hub' })} />, deck);
    expect(screen.getByRole('group', { name: new RegExp(`^${name}: Hub`) })).toBeInTheDocument();
  });

  it('shows an unknown type as its raw id with the fallback tile', () => {
    const { container } = renderWithEditor(
      <DeckNode {...props({ kind: 'robot', title: 'Rover' })} />,
      deck,
    );
    expect(screen.getByRole('group', { name: /^robot: Rover/ })).toBeInTheDocument();
    expect(container.querySelector('[data-icon="lucide:shapes"]')).not.toBeNull();
  });

  it('keeps the six legacy types drawing the icon they always had', () => {
    const icons = {
      service: 'box',
      database: 'database',
      gateway: 'router',
      client: 'monitor-smartphone',
      queue: 'arrow-left-right',
      external: 'cloud',
    };
    for (const [kind, icon] of Object.entries(icons)) {
      const { container, unmount } = renderWithEditor(<DeckNode {...props({ kind })} />, deck);
      expect(container.querySelector(`[data-icon="lucide:${icon}"]`), kind).not.toBeNull();
      unmount();
    }
  });
});

describe('DeckNode typed fields (032)', () => {
  const view: CardFieldView = {
    header: {
      fieldId: 'stage',
      kind: 'status',
      name: 'Status: In progress',
      text: 'In progress',
      color: 'blue',
      icon: 'circle-dot',
    },
    chips: [
      { fieldId: 'region', kind: 'select', name: 'Region: South', text: 'South', color: 'amber' },
      { fieldId: 'who', kind: 'person', name: 'Assignee: Lan', text: 'Lan', initials: 'L' },
      { fieldId: 'due', kind: 'date', name: 'Due date: 14 Oct', text: '14 Oct' },
    ],
    rows: [
      { fieldId: 'cap', kind: 'progress', label: 'Capacity', text: '82 %', progress: 82 },
      { fieldId: 'sla', kind: 'number', label: 'SLA', text: '24 h' },
      {
        fieldId: 'doc',
        kind: 'link',
        label: 'Runbook',
        text: 'runbook.sodo.dev/orders',
        href: 'https://runbook.sodo.dev/orders',
      },
    ],
    hidden: 3,
  };

  beforeEach(() => {
    connection.role = null;
    connection.connecting = false;
  });

  it('draws the header status, the chip shelf, the rows and the "+N fields" pill', () => {
    renderNode(props({ level: 'container', fields: view }));
    expect(screen.getByTestId('header-status')).toHaveTextContent('In progress');
    const chips = within(screen.getByRole('list', { name: 'Fields' })).getAllByRole('listitem');
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Region: South',
      'Assignee: Lan',
      'Due date: 14 Oct',
    ]);
    const rows = within(screen.getByRole('list', { name: 'Field values' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Capacity: 82 %',
      'SLA: 24 h',
      'Runbook: runbook.sodo.dev/orders',
    ]);
    const link = screen.getByRole('link', { name: /runbook\.sodo\.dev/ });
    expect(link).toHaveAttribute('href', 'https://runbook.sodo.dev/orders');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('button', { name: '3 more fields' })).toHaveTextContent('+3 fields');
  });

  it('opens the drawer at the fields from the pill, selecting the card', async () => {
    const user = userEvent.setup();
    renderNode(props({ level: 'container', fields: view }));
    await user.click(screen.getByRole('button', { name: '3 more fields' }));
    const ui = useUiStore.getState();
    expect(ui.selection.nodes).toEqual(['svc']);
    expect(ui.drawer.open).toBe(true);
    expect(ui.drawerSection).toBe('fields');
  });

  it('shows the header status as a named icon on a narrow card', () => {
    const layout = cardLayout({ title: 'Order Service', size: { width: 140, height: 120 } });
    renderNode(props({ level: 'container', fields: view }, false, 'svc', layout));
    expect(screen.getByRole('img', { name: 'Status: In progress' })).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('draws chips as named dots and no rows at System level', () => {
    renderNode(props({ level: 'system', fields: view }));
    const dots = within(screen.getByRole('list', { name: 'Fields' })).getAllByRole('listitem');
    expect(dots.map((dot) => dot.getAttribute('aria-label'))).toEqual([
      'Region: South',
      'Assignee: Lan',
      'Due date: 14 Oct',
    ]);
    for (const dot of dots) expect(dot).toBeEmptyDOMElement();
    expect(screen.queryByRole('list', { name: 'Field values' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Status: In progress' })).toBeInTheDocument();
  });

  it('draws no fields at Landscape level, and nothing for a card without fields', () => {
    const { unmount } = renderNode(props({ level: 'landscape', fields: view }));
    expect(screen.queryByTestId('card-fields')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-status')).not.toBeInTheDocument();
    unmount();
    renderNode(props({ level: 'container' }));
    expect(screen.queryByTestId('card-fields')).not.toBeInTheDocument();
  });
});

describe('DeckNode as a table card (041)', () => {
  const columns = [
    { id: 'o-id', name: 'id', type: 'uuid', pk: true },
    { id: 'o-customer', name: 'customer_id', type: 'uuid', notNull: true },
    { id: 'o-number', name: 'number', type: 'text', unique: true },
    { id: 'o-coupon', name: 'coupon_code', type: 'text' },
    { id: 'o-total', name: 'total_cents', type: 'int', notNull: true },
    { id: 'o-created', name: 'created_at', type: 'timestamptz', notNull: true },
    { id: 'o-paid', name: 'paid', type: 'boolean', notNull: true },
  ];
  const ordersNode = {
    id: 'orders',
    type: 'db-table',
    title: 'orders',
    schema: 'public',
    description: 'One row per checkout.',
    columns,
    indexes: [{ id: 'ix', columns: ['o-customer'] }],
  };
  const tables = (extra: Record<string, unknown>[] = []) =>
    deckOf({
      nodes: [
        ordersNode,
        { id: 'customers', type: 'db-table', title: 'customers', columns: [] },
        ...extra,
      ] as never,
      edges: [
        {
          id: 'r',
          from: 'orders',
          to: 'customers',
          fromColumns: ['o-customer'],
          toColumns: ['o-id'],
          cardinality: 'n-1',
        },
      ],
    });

  function tableProps(file = tables(), patch: PropsPatch = {}, node = ordersNode) {
    const layout = cardLayoutOf(node, { table: tableContextOf(file) });
    return props({ title: node.title, kind: 'db-table', ...patch }, false, node.id, layout);
  }

  it('is named "Table <title>, <n> columns" with the table role description', () => {
    renderWithEditor(<DeckNode {...tableProps()} />, tables());
    const card = screen.getByRole('group', { name: 'Table orders, 7 columns' });
    expect(card).toHaveAttribute('aria-roledescription', 'table');
    expect(within(card).getByRole('list', { name: 'Columns' })).toBeInTheDocument();
    expect(within(card).getByText('One row per checkout.')).toBeInTheDocument();
  });

  it('reads "Table" with one schema and "Table · <schema>" with two', () => {
    const { unmount } = renderWithEditor(<DeckNode {...tableProps()} />, tables());
    expect(screen.getByTestId('card-header')).toHaveTextContent(/^Table$/);
    unmount();
    const two = tables([{ id: 'users', type: 'db-table', title: 'users', schema: 'auth' }]);
    renderWithEditor(<DeckNode {...tableProps(two)} />, two);
    expect(screen.getByTestId('card-header')).toHaveTextContent('Table · public');
  });

  it('keeps a long title in its name, cut to one line', () => {
    const long = { ...ordersNode, title: 'order_line_items_with_a_much_longer_name_than_fits' };
    renderWithEditor(<DeckNode {...tableProps(tables(), {}, long)} />, tables());
    expect(
      screen.getByRole('group', { name: `Table ${long.title}, 7 columns` }),
    ).toBeInTheDocument();
  });

  it('shows the title, key dots and column count at System level', () => {
    renderWithEditor(<DeckNode {...tableProps(tables(), { level: 'system' })} />, tables());
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '1 primary key, 1 foreign key, 7 columns' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Columns' })).not.toBeInTheDocument();
  });

  it('shows the icon plate at Landscape level, in the same box', () => {
    const p = tableProps(tables(), { level: 'landscape' });
    renderWithEditor(<DeckNode {...p} />, tables());
    expect(screen.getByTestId('card-plate-icon')).toBeInTheDocument();
    expect(screen.queryByText('orders')).not.toBeInTheDocument();
    const box = screen.getByRole('group', { name: 'Table orders, 7 columns' });
    expect(box.style.height).toBe(`${String(p.data.layout.height)}px`);
  });

  it('cycles its own detail from the header toggle: deck → Keys → All → deck', async () => {
    const user = userEvent.setup();
    const file = tables();
    const { editor, doc } = renderWithEditor(<DeckNode {...tableProps(file)} />, file);
    await user.click(screen.getByRole('button', { name: 'Detail: Use deck setting' }));
    expect(deckFile(doc).nodes.find((n) => n.id === 'orders')?.detail).toBe('keys');
    editor().undo();
    expect(deckFile(doc).nodes.find((n) => n.id === 'orders')?.detail).toBeUndefined();
  });

  it('labels the toggle with the table’s own choice', () => {
    const file = tables();
    const node = { ...ordersNode, detail: 'all' as const };
    renderWithEditor(<DeckNode {...tableProps(file, {}, node)} />, file);
    expect(screen.getByRole('button', { name: 'Detail: All' })).toBeInTheDocument();
  });
});
