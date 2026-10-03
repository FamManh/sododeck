import type { SododeckFile, View } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck } from '../../test/flow-fixtures';
import { deckOf } from '../../test/render-canvas';
import { useUiStore } from '../../state/ui-store';
import { cardLayout } from '../card-layout';
import { NODE_SIZE } from '../canvas-geometry';
import { LIGHT_PALETTE } from './export-palette';
import { buildScene, EXPORT_MARGIN, type SceneInput } from './scene';

const ui: SceneInput['ui'] = {
  currentViewId: null,
  revealed: new Set(),
  drill: [],
  activeFlowId: null,
  notesDisplay: 'dimmed',
};

function scene(deck: SododeckFile, scope: SceneInput['scope'] = 'deck', patch = {}) {
  return buildScene({ deck, scope, ui: { ...ui, ...patch } });
}

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id).sort();

/** Two grouped services, a database outside, a note on each side. */
const grouped = deckOf({
  name: 'Grouped',
  nodes: [
    { id: 'a', type: 'service', title: 'Orders', tech: 'Go', position: { x: 0, y: 0 }, group: 'g' },
    { id: 'b', type: 'service', title: 'Billing', position: { x: 0, y: 160 }, group: 'g' },
    {
      id: 'db',
      type: 'database',
      title: 'Orders DB',
      owner: 'Data team',
      position: { x: 400, y: 0 },
      rules: ['r1'],
    },
  ],
  groups: [{ id: 'g', title: 'Core' }],
  edges: [
    { id: 'a-b', from: 'a', to: 'b' },
    { id: 'a-db', from: 'a', to: 'db', label: 'SQL', direction: 'both' },
    { id: 'b-db', from: 'b', to: 'db', direction: 'none' },
  ],
  rules: { r1: { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
  stickies: [
    { id: 'free', text: 'Free note', position: { x: 0, y: 300 } },
    { id: 'on-db', text: 'On the DB', anchor: 'db', color: 'blue' },
  ],
});

const view = (patch: Partial<View> = {}): View => ({
  id: 'v',
  type: 'custom',
  title: 'V',
  ...patch,
});

describe('buildScene: whole deck', () => {
  it('draws every card, group frame, edge and note', () => {
    const result = scene(grouped);
    expect(ids(result.cards)).toEqual(['a', 'b', 'db']);
    expect(ids(result.groups)).toEqual(['g']);
    expect(result.groups[0]).toMatchObject({ label: 'Core', count: 2 });
    expect(ids(result.edges)).toEqual(['a-b', 'a-db', 'b-db']);
    expect(ids(result.stickies)).toEqual(['free', 'on-db']);
    expect(result.collapsed).toEqual([]);
    expect(result.ports).toEqual([]);
  });

  it('describes cards like the canvas at 100 %', () => {
    const cards = new Map(scene(grouped).cards.map((card) => [card.id, card]));
    expect(cards.get('a')).toMatchObject({
      kind: 'service',
      title: 'Orders',
      description: 'Go',
      hasRules: false,
      level: 'container',
      rect: {
        x: 0,
        y: 0,
        width: NODE_SIZE.width,
        height: cardLayout({ title: 'Orders', description: 'Go' }).height,
      },
    });
    expect(cards.get('db')).toMatchObject({ kind: 'database', description: null, hasRules: true });
  });

  it('carries edge directions and keeps labels', () => {
    const edges = new Map(scene(grouped).edges.map((edge) => [edge.id, edge]));
    expect(edges.get('a-b')).toMatchObject({
      direction: 'forward',
      label: null,
      stroke: 'default',
    });
    expect(edges.get('a-db')).toMatchObject({ direction: 'both', label: 'SQL', badges: [] });
    expect(edges.get('b-db')?.direction).toBe('none');
  });

  it('carries the line type from edgeShape, with the ends on the card sides (029 R4)', () => {
    const shaped = {
      ...grouped,
      edges: [
        { id: 'curved', from: 'a', to: 'db' },
        { id: 'straight', from: 'a', to: 'db', style: { shape: 'straight' as const } },
        { id: 'elbow', from: 'a', to: 'db', route: { offset: 10 } },
      ],
    };
    const edges = new Map(scene(shaped).edges.map((edge) => [edge.id, edge]));
    expect(edges.get('curved')?.shape).toBe('curved');
    expect(edges.get('straight')?.shape).toBe('straight');
    // Files from before 029 with a route offset stay elbow.
    expect(edges.get('elbow')?.shape).toBe('elbow');
    const straight = edges.get('straight');
    expect(straight?.path).toMatch(/^M [\d.-]+ [\d.-]+ L /);
    expect(straight?.ends.start).toEqual(straight?.source);
    expect(straight?.ends.end).toEqual(straight?.target);
  });

  it('draws each card at its cardLayout box, with its fields (029 R7, R13)', () => {
    const rich = deckOf({
      nodes: [
        {
          id: 'a',
          type: 'database',
          title: 'Orders database with a rather long title that wraps',
          tech: 'Postgres 16 holding every order and its line items for the shop',
          tags: ['core', 'pii'],
          position: { x: 10, y: 20 },
        },
        { id: 'p', type: 'service', title: 'Parent', position: { x: 300, y: 0 } },
        { id: 'c', type: 'service', title: 'Child', parent: 'p', position: { x: 0, y: 0 } },
      ],
    });
    const cards = new Map(scene(rich).cards.map((card) => [card.id, card]));
    const card = cards.get('a');
    const expected = cardLayout({
      title: 'Orders database with a rather long title that wraps',
      description: 'Postgres 16 holding every order and its line items for the shop',
      tags: ['core', 'pii'],
    });
    expect(card).toMatchObject({
      typeName: 'Database',
      description: 'Postgres 16 holding every order and its line items for the shop',
      tags: ['core', 'pii'],
      layout: expected,
      rect: { x: 10, y: 20, width: expected.width, height: expected.height },
    });
    expect(card?.titleLines.length).toBe(expected.titleLines);
    expect(card?.descriptionLines.length).toBe(expected.descriptionLines);
    expect(Math.max(...(card?.tagChips.map((chip) => chip.row) ?? [-1])) + 1).toBe(
      expected.tagRows,
    );
    // The "n inside" row makes the parent taller, as on the canvas.
    const parent = cards.get('p');
    expect(parent?.layout.hasChildrenRow).toBe(true);
    expect(parent?.rect.height).toBe(cardLayout({ title: 'Parent', childCount: 1 }).height);
  });

  it('gives each tag pill its own export colours, matched by key, slate when none (033)', () => {
    const coloured = deckOf({
      tagColors: { PCI: 'violet', Lan: '#1f2a44' },
      nodes: [
        {
          id: 'a',
          type: 'service',
          title: 'A',
          tags: ['pci', 'Lan', 'plain'],
          style: { fill: 'green' },
          position: { x: 0, y: 0 },
        },
      ],
    });
    const card = scene(coloured).cards.find((item) => item.id === 'a');
    const pick = ({ tag, chip, ink }: { tag: string; chip: string; ink: string }) => ({
      tag,
      chip,
      ink,
    });
    expect(card?.tagChips.map(pick)).toEqual([
      { tag: 'pci', ...LIGHT_PALETTE.cardChips.violet },
      { tag: 'Lan', chip: '#1f2a44', ink: LIGHT_PALETTE.cardText.light },
      { tag: 'plain', ...LIGHT_PALETTE.cardChips.slate },
    ]);
  });

  it('has no description or tags on a bare card', () => {
    const card = scene(grouped).cards.find((item) => item.id === 'b');
    expect(card).toMatchObject({ description: null, tags: [], titleLines: ['Billing'] });
    expect(card?.tagChips).toEqual([]);
  });

  it('puts the group frame around both members', () => {
    const { groups, cards } = scene(grouped);
    const frame = groups[0]?.rect;
    expect(frame).toBeDefined();
    for (const card of cards.filter((c) => c.id !== 'db')) {
      expect(card.rect.x).toBeGreaterThan(frame?.x ?? Infinity);
      expect(card.rect.y).toBeGreaterThan(frame?.y ?? Infinity);
      expect(card.rect.x + card.rect.width).toBeLessThan((frame?.x ?? 0) + (frame?.width ?? 0));
      expect(card.rect.y + card.rect.height).toBeLessThan((frame?.y ?? 0) + (frame?.height ?? 0));
    }
  });

  it('draws a stored frame larger than its members as stored (016)', () => {
    const framed = {
      ...grouped,
      groups: [
        {
          id: 'g',
          title: 'Core',
          position: { x: -300, y: -200 },
          size: { width: 900, height: 700 },
        },
      ],
    };
    expect(scene(framed).groups[0]?.rect).toEqual({ x: -300, y: -200, width: 900, height: 700 });
  });

  it('draws a card at its own stored size (017)', () => {
    const resized = {
      ...grouped,
      nodes: grouped.nodes.map((node) =>
        node.id === 'a' ? { ...node, size: { width: 260, height: 140 } } : node,
      ),
    };
    const cards = new Map(scene(resized).cards.map((card) => [card.id, card]));
    expect(cards.get('a')?.rect).toMatchObject({ width: 260, height: 140 });
    expect(cards.get('b')?.rect).toMatchObject(NODE_SIZE);
  });

  it('routes an edge through its stored route (017)', () => {
    const elbowed = {
      ...grouped,
      edges: grouped.edges.map((edge) =>
        edge.id === 'a-b' ? { ...edge, style: { shape: 'elbow' as const } } : edge,
      ),
    };
    const routed = {
      ...grouped,
      edges: elbowed.edges.map((edge) =>
        edge.id === 'a-b' ? { ...edge, route: { offset: 40 } } : edge,
      ),
    };
    const plainLabelY = scene(elbowed).edges.find((edge) => edge.id === 'a-b')?.labelPoint.y;
    const edge = scene(routed).edges.find((edge) => edge.id === 'a-b');
    expect(edge?.labelPoint.y).toBe((plainLabelY ?? 0) + 40);
  });

  it("carries a connector's own style, resolved for the light export (022)", () => {
    const styled = {
      ...grouped,
      edges: grouped.edges.map((edge) =>
        edge.id === 'a-b'
          ? {
              ...edge,
              style: { dash: 'dashed' as const, width: 3 as const, color: 'blue' as const },
            }
          : edge,
      ),
    };
    const find = (file: typeof grouped, id: string) =>
      scene(file).edges.find((edge) => edge.id === id);
    expect(find(styled, 'a-b')?.style).toEqual({
      width: 3,
      colour: '#4087de',
      dash: '12 10.5',
    });
    expect(find(grouped, 'a-b')).not.toHaveProperty('style');
  });

  it('bounds every shape plus the margin', () => {
    const { bounds, cards, groups, stickies } = scene(grouped);
    for (const rect of [...cards, ...groups, ...stickies].map((item) => item.rect)) {
      expect(rect.x - bounds.x).toBeGreaterThanOrEqual(EXPORT_MARGIN);
      expect(rect.y - bounds.y).toBeGreaterThanOrEqual(EXPORT_MARGIN);
      expect(bounds.x + bounds.width - (rect.x + rect.width)).toBeGreaterThanOrEqual(EXPORT_MARGIN);
      expect(bounds.y + bounds.height - (rect.y + rect.height)).toBeGreaterThanOrEqual(
        EXPORT_MARGIN,
      );
    }
    const left = Math.min(...[...cards, ...groups, ...stickies].map((item) => item.rect.x));
    expect(bounds.x).toBe(left - EXPORT_MARGIN);
  });

  it('expands collapsed groups and ignores the drill level', () => {
    const collapsedView = { ...grouped, views: [view({ collapsed: ['g'] })] };
    const result = scene(collapsedView, 'deck', {
      currentViewId: 'v',
      drill: [{ kind: 'group', id: 'g' }],
    });
    expect(result.collapsed).toEqual([]);
    expect(ids(result.cards)).toEqual(['a', 'b', 'db']);
  });

  it('shows nested components as the parent card with a child count', () => {
    const nested = deckOf({
      nodes: [
        { id: 'p', type: 'service', title: 'Parent', position: { x: 0, y: 0 } },
        { id: 'c1', type: 'service', title: 'Child', parent: 'p', position: { x: 0, y: 0 } },
        { id: 'c2', type: 'service', title: 'Child 2', parent: 'p', position: { x: 0, y: 90 } },
      ],
    });
    const { cards } = scene(nested);
    expect(ids(cards)).toEqual(['p']);
    expect(cards[0]?.childCount).toBe(2);
  });

  it('draws notes on connections, flows and steps at their own point, as the canvas', () => {
    const notes = {
      ...grouped,
      stickies: [
        { id: 'on-edge', text: 'On an edge', anchor: 'a-db', position: { x: 5, y: 6 } },
        { id: 'empty', text: '', position: { x: 0, y: 0 } },
      ],
    };
    const { stickies } = scene(notes);
    expect(ids(stickies)).toEqual(['empty', 'on-edge']);
    expect(stickies.find((note) => note.id === 'empty')?.label).toBe('Empty note');
  });

  it('is empty for an empty deck', () => {
    const result = scene(deckOf({ stickies: [{ id: 's', text: 'x', position: { x: 0, y: 0 } }] }));
    expect(result.cards).toEqual([]);
    expect(result.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("resolves a card and a group's colour to literal hex (020 T057)", () => {
    const coloured = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', style: { fill: 'green' }, group: 'g' },
        { id: 'b', type: 'service', title: 'B', style: { fill: '#123456' } },
      ],
      groups: [{ id: 'g', title: 'G', style: { stroke: 'red' } }],
    });
    const result = scene(coloured);
    expect(result.cards.find((card) => card.id === 'a')).toMatchObject({
      fill: '#d9f8e0',
      text: 'default',
    });
    expect(result.cards.find((card) => card.id === 'b')).toMatchObject({
      fill: '#123456',
      text: 'light',
    });
    expect(result.groups.find((group) => group.id === 'g')).toMatchObject({
      stroke: '#d15c53',
      text: 'default',
    });
  });

  it('carries no colour for a plain card or group', () => {
    const result = scene(grouped);
    expect(result.cards[0]?.fill).toBeUndefined();
    expect(result.cards[0]?.stroke).toBeUndefined();
    expect(result.cards[0]?.text).toBe('default');
    expect(result.groups[0]?.fill).toBeUndefined();
    expect(result.groups[0]?.stroke).toBeUndefined();
    expect(result.groups[0]?.text).toBe('default');
  });
});

describe('buildScene: current view', () => {
  it('equals the whole deck when the view hides and collapses nothing', () => {
    const plain = { ...grouped, views: [view()] };
    expect(scene(plain, 'view', { currentViewId: 'v' })).toEqual(scene(plain, 'deck'));
  });

  it('drops hidden kinds and their edges', () => {
    const hiding = { ...grouped, views: [view({ excludeKinds: ['database'] })] };
    const result = scene(hiding, 'view', { currentViewId: 'v' });
    expect(ids(result.cards)).toEqual(['a', 'b']);
    expect(ids(result.edges)).toEqual(['a-b']);
    expect(ids(result.stickies)).toEqual(['free']);
  });

  it('draws a collapsed group as one card with counts and a merged edge', () => {
    const collapsing = { ...grouped, views: [view({ collapsed: ['g'] })] };
    const result = scene(collapsing, 'view', { currentViewId: 'v' });
    expect(ids(result.cards)).toEqual(['db']);
    expect(result.groups).toEqual([]);
    expect(result.collapsed).toEqual([
      expect.objectContaining({
        id: 'g',
        title: 'Core',
        nodeCount: 2,
        edgeCount: 1,
        memberKinds: ['service', 'service'],
      }),
    ]);
    // Curved like the canvas's merged connector; a-db is two-way, so the bundle is too.
    expect(result.edges).toEqual([
      expect.objectContaining({
        label: '×2',
        shape: 'curved',
        direction: 'both',
        stroke: 'default',
      }),
    ]);
  });

  it("carries the group's colour onto its collapsed card (020 T057)", () => {
    const colouredGroup = {
      ...grouped,
      groups: grouped.groups.map((g) => (g.id === 'g' ? { ...g, style: { fill: 'teal' } } : g)),
      views: [view({ collapsed: ['g'] })],
    };
    const result = scene(colouredGroup, 'view', { currentViewId: 'v' });
    expect(result.collapsed[0]).toMatchObject({ id: 'g', fill: '#cff9f1' });
  });

  it('draws only the members when drilled into a group, with port pills for outside ends', () => {
    const result = scene(grouped, 'view', { drill: [{ kind: 'group', id: 'g' }] });
    expect(ids(result.cards)).toEqual(['a', 'b']);
    expect(result.ports.map((port) => port.label)).toEqual(['Orders DB']);
    expect(ids(result.edges)).toEqual(['a-b', 'a-db', 'b-db']);
  });

  it('uses the component level when drilled into a component', () => {
    const nested = deckOf({
      nodes: [
        { id: 'p', type: 'service', title: 'Parent', position: { x: 0, y: 0 } },
        { id: 'c1', type: 'service', title: 'Child', parent: 'p', position: { x: 0, y: 0 } },
      ],
    });
    const result = scene(nested, 'view', { drill: [{ kind: 'node', id: 'p' }] });
    expect(ids(result.cards)).toEqual(['c1']);
    expect(result.cards[0]).toMatchObject({ level: 'component', rect: NODE_SIZE });
  });

  it('uses the view subtitle field', () => {
    const owners = { ...grouped, views: [view({ subtitleField: 'owner' })] };
    const cards = scene(owners, 'view', { currentViewId: 'v' }).cards;
    expect(cards.find((card) => card.id === 'db')?.description).toBe('Data team');
    expect(cards.find((card) => card.id === 'a')?.description).toBeNull();
  });
});

describe('buildScene: selected flow', () => {
  const withNotes: SododeckFile = {
    ...branchedDeck,
    stickies: [
      { id: 'on-b', text: 'On the gateway', anchor: 'b' },
      { id: 'on-y', text: 'Unrelated', anchor: 'y' },
      { id: 'free', text: 'Free', position: { x: 0, y: 400 } },
    ],
  };

  it('keeps only the flow’s components and connections, numbered', () => {
    const result = scene(withNotes, 'flow', { activeFlowId: 'place' });
    expect(ids(result.cards)).toEqual(['a', 'b', 'c']);
    expect(ids(result.edges)).toEqual(['ab', 'bc']);
    const badges = new Map(result.edges.map((edge) => [edge.id, edge.badges]));
    expect(badges.get('ab')).toEqual([{ label: '1', errorPath: false }]);
    expect(badges.get('bc')).toEqual([{ label: '2', errorPath: false }]);
    expect(result.edges.every((edge) => edge.stroke === 'flow')).toBe(true);
  });

  it('numbers branches and marks error paths', () => {
    const result = scene(withNotes, 'flow', { activeFlowId: 'pay' });
    expect(ids(result.cards)).toEqual(['a', 'b', 'c', 'd', 'x']);
    const edges = new Map(result.edges.map((edge) => [edge.id, edge]));
    expect(edges.get('cd')?.badges).toEqual([{ label: '3a', errorPath: false }]);
    expect(edges.get('cx')).toMatchObject({
      stroke: 'flow-error',
      badges: [{ label: '3b', errorPath: true }],
    });
  });

  it('keeps notes on the shown flow and its steps, not on other flows', () => {
    const notes: SododeckFile = {
      ...branchedDeck,
      stickies: [
        { id: 'on-flow', text: 'Flow note', anchor: 'place' },
        { id: 'on-step', text: 'Step note', anchor: 's2' },
        { id: 'other', text: 'Other flow', anchor: 'pay' },
      ],
    };
    expect(ids(scene(notes, 'flow', { activeFlowId: 'place' }).stickies)).toEqual([
      'on-flow',
      'on-step',
    ]);
  });

  it('keeps notes on kept components unless notes are hidden', () => {
    expect(ids(scene(withNotes, 'flow', { activeFlowId: 'place' }).stickies)).toEqual(['on-b']);
    expect(
      scene(withNotes, 'flow', { activeFlowId: 'place', notesDisplay: 'hidden' }).stickies,
    ).toEqual([]);
  });

  it('is empty for a flow without steps or a missing flow', () => {
    expect(scene(flowDeck, 'flow', { activeFlowId: 'assign' }).cards).toEqual([]);
    expect(scene(flowDeck, 'flow', { activeFlowId: 'gone' }).bounds.width).toBe(0);
  });

  it('keeps the frame of a group around a kept card only', () => {
    const grouped2: SododeckFile = {
      ...flowDeck,
      groups: [
        { id: 'front', title: 'Front' },
        { id: 'data', title: 'Data' },
      ],
      nodes: flowDeck.nodes.map((node) =>
        node.id === 'a'
          ? { ...node, group: 'front' }
          : node.id === 'y'
            ? { ...node, group: 'data' }
            : node,
      ),
    };
    expect(ids(scene(grouped2, 'flow', { activeFlowId: 'place' }).groups)).toEqual(['front']);
  });

  it('has no playback marks for a deck with an open flow (035 R10)', () => {
    const result = scene(branchedDeck, 'flow', { activeFlowId: 'pay' });
    const text = JSON.stringify(result);
    for (const mark of ['"step"', '"state"', '"currentStep"', '"inPath"', 'sticker', 'token']) {
      expect(text).not.toContain(mark);
    }
  });
});

describe('buildScene label position (022 US4)', () => {
  // The a → db connector is long enough (about 240 px) for the label to move.
  const withLabel = (labelAt?: number) => ({
    ...grouped,
    edges: grouped.edges.map((edge) =>
      edge.id === 'a-db'
        ? { ...edge, label: 'call', ...(labelAt === undefined ? {} : { labelAt }) }
        : edge,
    ),
  });
  const find = (file: typeof grouped) => scene(file).edges.find((edge) => edge.id === 'a-db');

  it('puts the label at the stored fraction of the drawn line', () => {
    const middle = find(withLabel());
    const early = find(withLabel(0.2));
    expect(early?.labelPoint).not.toEqual(middle?.labelPoint);
    expect(early?.path).toBe(middle?.path);
  });

  it('stays on the path and off the cards at the extremes', () => {
    const start = find(withLabel(0))?.labelPoint;
    const end = find(withLabel(1))?.labelPoint;
    const edge = find(withLabel());
    expect(
      Math.hypot((start?.x ?? 0) - (edge?.source.x ?? 0), (start?.y ?? 0) - (edge?.source.y ?? 0)),
    ).toBeGreaterThanOrEqual(8);
    expect(
      Math.hypot((end?.x ?? 0) - (edge?.target.x ?? 0), (end?.y ?? 0) - (edge?.target.y ?? 0)),
    ).toBeGreaterThanOrEqual(8);
  });
});

describe('buildScene: bundles and proxies (034 R9)', () => {
  const parallel = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'a', to: 'b' },
      { id: 'e3', from: 'b', to: 'a' },
    ],
    flows: [{ id: 'f', title: 'F', steps: [{ id: 's1', edge: 'e2' }] }],
  });

  it('draws parallel connectors as one folded curve with an "×n" count pill', () => {
    const result = scene(parallel);
    expect(result.edges.map((e) => e.id)).toEqual(['bundle:a|b']);
    expect(result.edges[0]).toMatchObject({
      label: '×3',
      count: true,
      direction: 'both',
      shape: 'curved',
    });
  });

  it("keeps the exported flow's connector on its own, with its badge, and no bundle of one", () => {
    const result = scene(parallel, 'flow', { activeFlowId: 'f' });
    expect(result.edges.map((e) => e.id)).toEqual(['e2']);
    expect(result.edges[0]?.badges).toHaveLength(1);
  });

  it('places drill-in proxies as the canvas does: 150 × 52, outside the scope', () => {
    const result = scene(grouped, 'view', { drill: [{ kind: 'group', id: 'g' }] });
    const [port] = result.ports;
    expect(port).toMatchObject({ id: 'port:db', label: 'Orders DB', kind: 'database' });
    expect(port?.rect).toMatchObject({ width: 150, height: 52 });
    const cards = result.cards.map((c) => c.rect.x + c.rect.width);
    expect(port?.rect.x ?? 0).toBeGreaterThan(Math.max(...cards));
  });

  it('is not changed by hover or pinned focus, which are UI state', () => {
    const before = JSON.stringify(scene(parallel));
    useUiStore.getState().setHoverFocus({ id: 'a', source: 'pointer' });
    useUiStore.getState().toggleBundleFan('bundle:a|b');
    useUiStore.getState().setFocusMode(true);
    const after = JSON.stringify(scene(parallel));
    useUiStore.getState().clearHoverFocus();
    useUiStore.getState().foldBundles();
    useUiStore.getState().setFocusMode(false);
    expect(after).toBe(before);
  });
});

describe('buildScene card types (030)', () => {
  it('maps each type to its export icon, unknown to the fallback, with the registry name', () => {
    const typed = deckOf({
      nodes: [
        { id: 'w', type: 'warehouse', title: 'Hub', position: { x: 0, y: 0 } },
        { id: 't', type: 'truck-route', title: 'Route', position: { x: 300, y: 0 } },
        { id: 'r', type: 'robot', title: 'Rover', position: { x: 600, y: 0 } },
      ],
    });
    const cards = new Map(scene(typed).cards.map((card) => [card.id, card]));
    expect(cards.get('w')).toMatchObject({ kind: 'warehouse', typeName: 'Warehouse' });
    expect(cards.get('t')).toMatchObject({ kind: 'truck-route', typeName: 'Truck route' });
    expect(cards.get('r')).toMatchObject({ kind: 'fallback', typeName: 'robot' });
  });
});

describe('shapes in the scene (031)', () => {
  const shapes = deckOf({
    nodes: [
      { id: 'ok', type: 'diamond', title: 'Payment OK?', position: { x: 0, y: 0 } },
      { id: 'db', type: 'database', title: 'Orders DB', position: { x: 400, y: 0 } },
      { id: 'para', type: 'parallelogram', title: 'Input', position: { x: 0, y: 400 } },
    ],
    edges: [
      { id: 'e1', from: 'ok', to: 'db' },
      { id: 'e2', from: 'para', to: 'db', route: { fromSide: 'right', toSide: 'bottom' } },
    ],
  });

  it('gives a shape its geometry, its default box and its title lines', () => {
    const card = scene(shapes).cards.find((c) => c.id === 'ok');
    expect(card).toMatchObject({
      geometry: 'diamond',
      rect: { x: 0, y: 0, width: 176, height: 112 },
      titleLines: ['Payment OK?'],
    });
    expect(scene(shapes).cards.find((c) => c.id === 'db')?.geometry).toBeUndefined();
  });

  it('ends connectors on the outline: a parallelogram’s slanted side', () => {
    const edge = scene(shapes).edges.find((e) => e.id === 'e2');
    expect(edge?.source.x).toBeCloseTo(168 - (168 * 0.16) / 2, 6);
    expect(edge?.source.y).toBeCloseTo(400 + 36, 6);
  });
});
