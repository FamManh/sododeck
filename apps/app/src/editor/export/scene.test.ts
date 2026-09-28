import type { SododeckFile, View } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck } from '../../test/flow-fixtures';
import { deckOf } from '../../test/render-canvas';
import { COMPONENT_CARD_SIZE, NODE_SIZE } from '../canvas-geometry';
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
    { id: 'b', type: 'service', title: 'Billing', position: { x: 0, y: 100 }, group: 'g' },
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
      subtitle: 'Go',
      hasRules: false,
      level: 'container',
      rect: { x: 0, y: 0, ...NODE_SIZE },
    });
    expect(cards.get('db')).toMatchObject({ kind: 'database', subtitle: null, hasRules: true });
  });

  it('maps edge directions to dots and keeps labels', () => {
    const edges = new Map(scene(grouped).edges.map((edge) => [edge.id, edge]));
    expect(edges.get('a-b')).toMatchObject({ dots: 'target', label: null, stroke: 'default' });
    expect(edges.get('a-db')).toMatchObject({ dots: 'both', label: 'SQL', badges: [] });
    expect(edges.get('b-db')?.dots).toBe('none');
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
      expect.objectContaining({ id: 'g', title: 'Core', nodeCount: 2, edgeCount: 1 }),
    ]);
    expect(result.edges).toEqual([
      expect.objectContaining({ label: '×2', dots: 'none', stroke: 'default' }),
    ]);
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
    expect(result.cards[0]).toMatchObject({ level: 'component', rect: COMPONENT_CARD_SIZE });
  });

  it('uses the view subtitle field', () => {
    const owners = { ...grouped, views: [view({ subtitleField: 'owner' })] };
    const cards = scene(owners, 'view', { currentViewId: 'v' }).cards;
    expect(cards.find((card) => card.id === 'db')?.subtitle).toBe('Data team');
    expect(cards.find((card) => card.id === 'a')?.subtitle).toBeNull();
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
});
