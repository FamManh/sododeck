import { stickyCanvasPosition } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { notesOnStep, stickyFlowState } from './sticky-flow';

function flowDeck() {
  const deck = emptySododeckFile();
  deck.nodes.push(
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 240, y: 0 } },
    { id: 'c', type: 'service', title: 'C', position: { x: 480, y: 0 } },
  );
  deck.edges.push({ id: 'ab', from: 'a', to: 'b' });
  deck.stickies.push(
    { id: 'free', text: 'Free note', position: { x: 16, y: 24 } },
    { id: 'current', text: 'Current node', anchor: 'a', position: { x: 12, y: 18 } },
    { id: 'other', text: 'Other node', anchor: 'c', position: { x: 24, y: 18 } },
    {
      id: 'always',
      text: 'Always visible',
      anchor: 'c',
      position: { x: 32, y: 18 },
      showInFlows: true,
    },
    { id: 'foreign', text: 'Foreign anchor', anchor: 'ab', position: { x: 8, y: 12 } },
    { id: 'missing', text: 'Missing anchor', anchor: 'gone', position: { x: 8, y: 12 } },
  );
  return deck;
}

describe('stickyFlowState', () => {
  it('is normal outside flow mode', () => {
    const deck = flowDeck();
    const sticky = deck.stickies[0];
    if (sticky === undefined) throw new Error('missing sticky');
    expect(
      stickyFlowState(sticky, stickyCanvasPosition(deck, sticky), {
        flowMode: false,
        display: 'dimmed',
        currentStepNodes: new Map(),
        emptyFlow: false,
        brokenCurrentStep: false,
      }),
    ).toBe('normal');
  });

  it('honors hidden and shown display modes', () => {
    const deck = flowDeck();
    const sticky = deck.stickies[0];
    if (sticky === undefined) throw new Error('missing sticky');
    const placement = stickyCanvasPosition(deck, sticky);
    expect(
      stickyFlowState(sticky, placement, {
        flowMode: true,
        display: 'hidden',
        currentStepNodes: new Map(),
        emptyFlow: false,
        brokenCurrentStep: false,
      }),
    ).toBe('hidden');
    expect(
      stickyFlowState(sticky, placement, {
        flowMode: true,
        display: 'shown',
        currentStepNodes: new Map(),
        emptyFlow: false,
        brokenCurrentStep: false,
      }),
    ).toBe('normal');
  });

  it('keeps showInFlows notes and notes pinned to the current step normal', () => {
    const deck = flowDeck();
    const current = deck.stickies.find((sticky) => sticky.id === 'current');
    const always = deck.stickies.find((sticky) => sticky.id === 'always');
    if (current === undefined || always === undefined) throw new Error('missing sticky');
    const marks = new Map([['a', { currentStep: true }]]);

    expect(
      stickyFlowState(current, stickyCanvasPosition(deck, current), {
        flowMode: true,
        display: 'dimmed',
        currentStepNodes: marks,
        emptyFlow: false,
        brokenCurrentStep: false,
      }),
    ).toBe('normal');
    expect(
      stickyFlowState(always, stickyCanvasPosition(deck, always), {
        flowMode: true,
        display: 'dimmed',
        currentStepNodes: marks,
        emptyFlow: false,
        brokenCurrentStep: false,
      }),
    ).toBe('normal');
  });

  it('dims free notes, notes pinned elsewhere, and foreign or missing anchors', () => {
    const deck = flowDeck();
    const marks = new Map([['a', { currentStep: true }]]);
    for (const id of ['free', 'other', 'foreign', 'missing']) {
      const sticky = deck.stickies.find((entry) => entry.id === id);
      if (sticky === undefined) throw new Error(`missing sticky ${id}`);
      expect(
        stickyFlowState(sticky, stickyCanvasPosition(deck, sticky), {
          flowMode: true,
          display: 'dimmed',
          currentStepNodes: marks,
          emptyFlow: false,
          brokenCurrentStep: false,
        }),
      ).toBe('dimmed');
    }
  });

  it('keeps every note normal in an empty flow, but dims broken current steps unless always shown', () => {
    const deck = flowDeck();
    const free = deck.stickies.find((sticky) => sticky.id === 'free');
    const always = deck.stickies.find((sticky) => sticky.id === 'always');
    if (free === undefined || always === undefined) throw new Error('missing sticky');

    expect(
      stickyFlowState(free, stickyCanvasPosition(deck, free), {
        flowMode: true,
        display: 'dimmed',
        currentStepNodes: new Map(),
        emptyFlow: true,
        brokenCurrentStep: false,
      }),
    ).toBe('normal');
    expect(
      stickyFlowState(free, stickyCanvasPosition(deck, free), {
        flowMode: true,
        display: 'dimmed',
        currentStepNodes: new Map(),
        emptyFlow: false,
        brokenCurrentStep: true,
      }),
    ).toBe('dimmed');
    expect(
      stickyFlowState(always, stickyCanvasPosition(deck, always), {
        flowMode: true,
        display: 'dimmed',
        currentStepNodes: new Map(),
        emptyFlow: false,
        brokenCurrentStep: true,
      }),
    ).toBe('normal');
  });
});

describe('notesOnStep', () => {
  it('returns notes pinned to either node in file order, excluding foreign and missing anchors', () => {
    const deck = flowDeck();
    expect(notesOnStep(deck, 'a', 'b').map((sticky) => sticky.id)).toEqual(['current']);
    expect(notesOnStep(deck, 'b', 'c').map((sticky) => sticky.id)).toEqual(['other', 'always']);
  });
});
