import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { useUiStore } from '../../state/ui-store';
import { visibleGraph } from '../visible-graph';
import { HoverFocusStyle } from './hover-focus-style';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
    { id: 'c', type: 'service', title: 'C' },
    { id: 'lone', type: 'service', title: 'Lone' },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
  ],
});
const graph = visibleGraph(deck, { node: null, group: null }, new Set());

function mount() {
  const wrapper = createRef<HTMLDivElement>();
  const view = render(
    <div ref={wrapper} data-testid="canvas">
      <HoverFocusStyle deck={deck} graph={graph} wrapper={wrapper} />
    </div>,
  );
  return { ...view, wrapper };
}

const css = (container: HTMLElement) => container.querySelector('style')?.textContent ?? '';

describe('HoverFocusStyle (034 R1)', () => {
  beforeEach(() => {
    useUiStore.setState({ hoverFocus: null });
  });

  it('renders no style and no marker without a hover focus', () => {
    const { container, getByTestId } = mount();
    expect(container.querySelector('style')).toBeNull();
    expect(getByTestId('canvas')).not.toHaveAttribute('data-hover-focus');
  });

  it('names exactly the focus set: members, their connectors and labels', () => {
    const { container, getByTestId } = mount();
    act(() => {
      useUiStore.getState().setHoverFocus({ id: 'a', source: 'pointer' });
    });
    expect(getByTestId('canvas')).toHaveAttribute('data-hover-focus');
    const text = css(container);
    // A's neighbourhood is a and b, and the connector ab; c, lone and bc are dimmed.
    expect(text).toMatch(
      /\.react-flow__node:not\(\.react-flow__node-group-boundary\):not\(:is\(\[data-id="a"\], \[data-id="b"\]\)\) \{ opacity: var\(--sd-deck-dim\)/,
    );
    expect(text).toMatch(
      /\.react-flow__edge:not\(:is\(\[data-id="ab"\]\)\) \{ opacity: var\(--color-deck-dim-edge\)/,
    );
    expect(text).toMatch(/\[data-edge-label-for\]:not\(:is\(\[data-edge-label-for="ab"\]\)\)/);
    expect(text).not.toContain('"bc"][');
  });

  it('lights member connectors Ink at 2.75 px, in separate declarations', () => {
    const { container } = mount();
    act(() => {
      useUiStore.getState().setHoverFocus({ id: 'b', source: 'keyboard' });
    });
    const rules = [...css(container).matchAll(/([^{}]+)\{([^}]*)\}/g)];
    const colour = rules.find((m) => (m[2] ?? '').includes('--sd-edge-hl-stroke'));
    const weight = rules.find((m) => (m[2] ?? '').includes('--sd-edge-hl-width'));
    expect(colour?.[2]).toMatch(/--sd-edge-hl-stroke:\s*var\(--color-ink\)/);
    expect(weight?.[2]).toMatch(/--sd-edge-hl-width:\s*2\.75px/);
    expect(colour?.[2]).not.toContain('--sd-edge-hl-width');
    expect(weight?.[2]).not.toContain('--sd-edge-hl-stroke');
    expect(colour?.[1]).toContain('[data-id="ab"]');
    expect(colour?.[1]).toContain('[data-id="bc"]');
  });

  it('gives neighbours, not the hovered card, the Secondary border and lip', () => {
    const { container } = mount();
    act(() => {
      useUiStore.getState().setHoverFocus({ id: 'b', source: 'pointer' });
    });
    const rule = [...css(container).matchAll(/([^{}]+)\{([^}]*)\}/g)].find((m) =>
      (m[2] ?? '').includes('--card-lip'),
    );
    expect(rule?.[1]).toContain('[data-id="a"]');
    expect(rule?.[1]).toContain('[data-id="c"]');
    expect(rule?.[1]).not.toContain('[data-id="b"]');
    expect(rule?.[2]).toMatch(/border-color:\s*var\(--color-ink-secondary\)/);
  });

  it('highlights a card with no connections alone', () => {
    const { container } = mount();
    act(() => {
      useUiStore.getState().setHoverFocus({ id: 'lone', source: 'pointer' });
    });
    const text = css(container);
    expect(text).toContain('[data-id="lone"]');
    expect(text).toMatch(/\.react-flow__edge \{ opacity: var\(--color-deck-dim-edge\)/);
    expect(text).not.toContain('--sd-edge-hl-stroke');
  });

  it('never sets inert or aria-hidden, and never raises a view-dimmed card', () => {
    const { container } = mount();
    act(() => {
      useUiStore.getState().setHoverFocus({ id: 'a', source: 'pointer' });
    });
    const text = css(container);
    expect(text).not.toMatch(/inert|aria-hidden/);
    // Only non-members get an opacity; members are left alone, so a view-dimmed member keeps
    // its view opacity (FR-004).
    expect(text).not.toMatch(/\.react-flow__node:is\([^)]*\)[^{]*\{[^}]*opacity/);
  });

  it('fades with the --sd-dur-dim token', () => {
    const { container } = mount();
    act(() => {
      useUiStore.getState().setHoverFocus({ id: 'a', source: 'pointer' });
    });
    expect(css(container)).toMatch(/transition:\s*opacity var\(--sd-dur-dim\)/);
  });

  it('drops the style and the marker when the hover clears, or the id is not visible', () => {
    const { container, getByTestId } = mount();
    act(() => {
      useUiStore.getState().setHoverFocus({ id: 'a', source: 'pointer' });
    });
    act(() => {
      useUiStore.getState().clearHoverFocus();
    });
    expect(container.querySelector('style')).toBeNull();
    expect(getByTestId('canvas')).not.toHaveAttribute('data-hover-focus');
    act(() => {
      useUiStore.getState().setHoverFocus({ id: 'missing', source: 'pointer' });
    });
    expect(container.querySelector('style')).toBeNull();
    expect(getByTestId('canvas')).not.toHaveAttribute('data-hover-focus');
  });

  it('escapes ids with CSS.escape, including collapsed and merged ones', () => {
    const grouped = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'c', type: 'service', title: 'C' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [{ id: 'ac', from: 'a', to: 'c' }],
    });
    const g = visibleGraph(grouped, { node: null, group: null }, new Set(['core']));
    const wrapper = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={wrapper}>
        <HoverFocusStyle deck={grouped} graph={g} wrapper={wrapper} />
      </div>,
    );
    act(() => {
      useUiStore.getState().setHoverFocus({ id: 'collapsed:core', source: 'pointer' });
    });
    const text = css(container);
    expect(text).toContain(`[data-id="${CSS.escape('collapsed:core')}"]`);
    expect(text).toContain(`[data-id="${CSS.escape('merged:c|collapsed:core')}"]`);
  });
});
