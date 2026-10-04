import { SHAPE_TYPE_IDS, shapeGeometryOf } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import type { DeckFlowNode } from '../deck-to-flow';
import { resolveLook } from '../style/card-style';
import { shapeLayout } from './shape-layout';
import { ShapeNode } from './shape-node';

const connection = vi.hoisted(() => ({ role: null as string | null, connecting: false }));

vi.mock('../use-connection-role', () => ({
  useConnectionRole: () => connection.role,
  useConnecting: () => connection.connecting,
}));

const deck = deckOf({
  nodes: [
    { id: 's', type: 'diamond', title: 'Payment OK?' },
    { id: 'db', type: 'database', display: 'shape', title: 'Orders DB' },
    { id: 'svc', type: 'service', title: 'Svc' },
  ],
});

function props(
  patch: Partial<DeckFlowNode['data']> & { type?: string; display?: 'card' | 'shape' } = {},
  selected = false,
) {
  const { type = 'diamond', display, ...rest } = patch;
  const geometry = shapeGeometryOf({ type, display }) ?? 'rect';
  const title = rest.title ?? 'Payment OK?';
  const layout = shapeLayout(geometry, { title });
  return {
    id: 's',
    type: 'shape',
    selected,
    width: layout.width,
    height: layout.height,
    data: {
      title,
      kind: type,
      subtitle: undefined,
      owner: undefined,
      tagLooks: [],
      hasRules: false,
      childCount: 0,
      dimmed: false,
      level: 'system',
      focused: false,
      geometry,
      layout,
      ...rest,
    },
  } as unknown as NodeProps<DeckFlowNode>;
}

const node = () => screen.getByTestId('shape-node');

describe('ShapeNode (031)', () => {
  beforeEach(() => {
    connection.role = null;
    connection.connecting = false;
  });

  it.each(SHAPE_TYPE_IDS)('%s draws its outline (none for text) and its centred title', (type) => {
    renderWithEditor(<ShapeNode {...props({ type, title: 'Step' })} />, deck);
    const geometry = shapeGeometryOf({ type });
    expect(node()).toHaveAttribute('data-geometry', geometry);
    if (type === 'text') {
      expect(screen.queryByTestId('shape-outline')).not.toBeInTheDocument();
    } else {
      expect(screen.getByTestId('shape-outline').getAttribute('d')).toMatch(/^M /);
    }
    // The lip where research R1 says so: every closed shape, not actor or text.
    const lipped = type !== 'actor' && type !== 'text';
    expect(screen.queryByTestId('shape-lip') !== null).toBe(lipped);
    expect(screen.getByTestId('shape-title')).toHaveTextContent('Step');
    expect(screen.getByTestId('shape-title')).toHaveClass('text-center');
  });

  it('draws an unnamed shape blank; its name and the text shape keep the placeholder', () => {
    const { unmount } = renderWithEditor(
      <ShapeNode {...props({ title: 'Untitled diamond' })} />,
      deck,
    );
    expect(screen.getByTestId('shape-title')).toHaveTextContent(/^$/);
    expect(node()).toHaveAccessibleName(/^Untitled diamond, /);
    unmount();
    renderWithEditor(<ShapeNode {...props({ type: 'text', title: 'Untitled text' })} />, deck);
    expect(screen.getByTestId('shape-title')).toHaveTextContent('Untitled text');
  });

  it('is a group named "<title>, <shape name>"', () => {
    renderWithEditor(<ShapeNode {...props()} />, deck);
    expect(screen.getByRole('group', { name: 'Payment OK?, diamond' })).toBeInTheDocument();
  });

  it('names an in-between type by its own type: "Orders DB, database"', () => {
    renderWithEditor(
      <ShapeNode {...props({ type: 'database', display: 'shape', title: 'Orders DB' })} />,
      deck,
    );
    expect(screen.getByRole('group', { name: 'Orders DB, database' })).toHaveAttribute(
      'data-geometry',
      'cylinder',
    );
  });

  it('clamps a long title to its lines and shows the full title as a tooltip trigger', () => {
    const title = 'A very long decision title that keeps going well past three lines of text';
    renderWithEditor(<ShapeNode {...props({ title })} />, deck);
    const shown = screen.getByTestId('shape-title');
    expect(shown.style.webkitLineClamp).toBe(String(shapeLayout('diamond', { title }).titleLines));
    expect(shown.parentElement?.tagName).toBe('SPAN');
  });

  it('applies fill and stroke colours, but not on the text shape', () => {
    const look = resolveLook({ fill: 'blue', stroke: 'red' });
    const { unmount } = renderWithEditor(<ShapeNode {...props({ look })} />, deck);
    expect(node().style.getPropertyValue('--card-fill')).not.toBe('');
    expect(node().style.getPropertyValue('--card-stroke')).not.toBe('');
    expect(node()).toHaveAttribute('aria-description', expect.stringMatching(/fill/i));
    unmount();
    renderWithEditor(<ShapeNode {...props({ type: 'text', look })} />, deck);
    expect(node().style.getPropertyValue('--card-fill')).toBe('');
  });

  it('shows only the geometry at Landscape', () => {
    renderWithEditor(<ShapeNode {...props({ level: 'landscape' })} />, deck);
    expect(screen.getByTestId('shape-outline')).toBeInTheDocument();
    expect(screen.queryByTestId('shape-title')).not.toBeInTheDocument();
  });

  it('edits the title in place when its title edit starts', () => {
    renderWithEditor(<ShapeNode {...props()} />, deck);
    act(() => {
      useUiStore.getState().startTitleEdit({ target: 'node', id: 's', isNew: false });
    });
    expect(within(node()).getByRole('textbox')).toHaveValue('Payment OK?');
  });

  describe('states (DESIGN.md Shape column), each with a cue that is not colour', () => {
    it('selected: a ring around the geometry and aria-selected', () => {
      renderWithEditor(<ShapeNode {...props({}, true)} />, deck);
      expect(screen.getByTestId('shape-selected-ring')).toBeInTheDocument();
      expect(node()).toHaveAttribute('aria-selected', 'true');
    });

    it('problem: a dashed ring and a counted badge top-right, named', () => {
      renderWithEditor(
        <ShapeNode
          {...props({ problems: { count: 2, label: '2 problems', titles: 'Broken chain' } })}
        />,
        deck,
      );
      expect(screen.getByTestId('problem-outline')).toHaveClass('sd-shape-problem');
      expect(screen.getByTestId('problem-glyph')).toHaveTextContent('2');
      expect(node()).toHaveAccessibleName('Payment OK?, diamond, 2 problems');
    });

    it('current step: a halo, aria-current and the sticker', () => {
      renderWithEditor(
        <ShapeNode {...props({ currentStep: true, step: { state: 'current', number: '3' } })} />,
        deck,
      );
      expect(screen.getByTestId('shape-halo')).toBeInTheDocument();
      expect(node()).toHaveAttribute('aria-current', 'step');
      expect(node()).toHaveAttribute('data-step-state', 'current');
    });

    it('dimmed: hidden from assistive tech and inert', () => {
      renderWithEditor(<ShapeNode {...props({ dimmed: true })} />, deck);
      expect(screen.getByTestId('shape-node')).toHaveAttribute('aria-hidden', 'true');
    });

    it('connection target: the "+" badge', () => {
      connection.role = 'target:svc';
      renderWithEditor(<ShapeNode {...props()} />, deck);
      expect(node()).toHaveClass('connect-target');
    });

    it('has children: the "n inside" pill below the shape', () => {
      renderWithEditor(<ShapeNode {...props({ childCount: 4 })} />, deck);
      expect(
        screen.getByRole('img', { name: '4 components inside, press Enter to open' }),
      ).toHaveClass('top-full');
    });
  });

  it('puts its four handles on the outline: a parallelogram’s left handle is inset', () => {
    renderWithEditor(<ShapeNode {...props({ type: 'parallelogram' })} />, deck);
    const handles = screen.getAllByRole('button', { name: 'Connect from Payment OK?' });
    expect(handles).toHaveLength(4);
    const left = handles.find((h) => h.getAttribute('data-handleid') === 'left');
    expect(Number.parseFloat(left?.style.left ?? '')).toBeCloseTo((168 * 0.16) / 2, 1);
  });

  it('centres every handle on its outline point, right and bottom too', () => {
    renderWithEditor(<ShapeNode {...props()} />, deck);
    for (const handle of screen.getAllByRole('button', { name: 'Connect from Payment OK?' })) {
      expect(handle.style.transform).toBe('translate(-50%, -50%)');
      expect(handle.style.right).toBe('auto');
      expect(handle.style.bottom).toBe('auto');
    }
  });

  it('draws the selected ring as a band 4 to 6 px outside the outline', () => {
    renderWithEditor(<ShapeNode {...props({}, true)} />, deck);
    const ring = screen.getByTestId('shape-selected-ring');
    expect(ring.style.strokeWidth).toBe('12');
    const mask = document.getElementById(ring.getAttribute('mask')?.slice(5, -1) ?? '');
    const widths = [...(mask?.querySelectorAll('path') ?? [])].map((p) =>
      p.getAttribute('stroke-width'),
    );
    expect(widths).toEqual(['12', '8']);
  });
});
