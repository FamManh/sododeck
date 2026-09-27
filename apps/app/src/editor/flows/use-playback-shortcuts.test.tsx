import { act, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { playbackDeck } from '../../test/flow-fixtures';
import { announced, renderFlows } from '../../test/render-flows';
import { openFlow } from './flow-mode';

function setup(flowId = 'order', stepId: string | null = null) {
  const view = renderFlows(playbackDeck);
  act(() => {
    openFlow(view.editor(), flowId, stepId);
  });
  return view;
}

/** A detached widget to send keys from. */
function element(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const target = host.querySelector<HTMLElement>('[data-target]');
  if (target === null) throw new Error('no target');
  return target;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('usePlaybackShortcuts', () => {
  it('moves the current step with → / ← and announces it', () => {
    const { ui } = setup();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(ui().activeFlow?.stepId).toBe('o3');
    expect(announced()).toBe('Step 3 of 8: Order Service → API Gateway');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(ui().activeFlow?.stepId).toBe('o2');
  });

  it('ignores keys in text fields, dialogs, menus and radiogroups', () => {
    const { ui } = setup();
    for (const html of [
      '<input data-target />',
      '<div role="dialog"><button data-target>x</button></div>',
      '<div role="menu"><div role="menuitem" data-target>x</div></div>',
      '<div role="radiogroup"><button role="radio" data-target>x</button></div>',
    ]) {
      fireEvent.keyDown(element(html), { key: 'ArrowRight' });
    }
    expect(ui().activeFlow?.stepId).toBe('o1');
  });

  it('does nothing outside flow mode', () => {
    const { ui } = renderFlows(playbackDeck);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(ui().activeFlow).toBeNull();
  });

  it('switches alternatives with ↓ / ↑ only while the picker shows', () => {
    const { ui, editor } = setup('fork');
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(ui().activeFlow?.alternativeId).toBeNull();
    act(() => {
      openFlow(editor(), 'fork', 'f4a');
    });
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(ui().activeFlow).toMatchObject({ alternativeId: 'failed', stepId: 'f4b' });
    expect(announced()).toBe(
      'Step 4b of 5: Payment Service → Notification Service, branch payment failed',
    );
    fireEvent.keyDown(document.body, { key: 'ArrowUp' });
    expect(ui().activeFlow).toMatchObject({ alternativeId: 'ok', stepId: 'f4a' });
  });

  it('exits with Esc, marking the flow last played; Delete does nothing', () => {
    const { ui, editor } = setup();
    act(() => {
      useUiStore.setState({ selection: { nodes: ['a'], edges: [] } });
    });
    fireEvent.keyDown(document.body, { key: 'Delete' });
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    expect(ui().pendingDelete).toBeNull();
    expect(editor().canUndo()).toBe(false);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(ui().activeFlow).toBeNull();
    expect(ui().lastPlayedFlowId).toBe('order');
  });
});
