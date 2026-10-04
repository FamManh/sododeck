import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { pick, startLandingControls } from './landing-controls';

function tabsPage() {
  document.body.innerHTML = `
    <div role="tablist">
      <button role="tab" id="t0" aria-controls="p0" aria-selected="false" tabindex="-1">JSON</button>
      <button role="tab" id="t1" aria-controls="p1" aria-selected="true" tabindex="0">DBML</button>
      <button role="tab" id="t2" aria-controls="p2" aria-selected="false" tabindex="-1">SQL</button>
    </div>
    <div role="tabpanel" id="p0" hidden></div>
    <div role="tabpanel" id="p1"></div>
    <div role="tabpanel" id="p2" hidden></div>`;
  const get = (id: string) => {
    const el = document.getElementById(id);
    if (el === null) throw new Error(id);
    return el;
  };
  return get;
}

describe('code panel tabs', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the clicked tab panel and hides the others', () => {
    const get = tabsPage();
    startLandingControls();
    fireEvent.click(get('t2'));
    expect(get('t2')).toHaveAttribute('aria-selected', 'true');
    expect(get('t1')).toHaveAttribute('aria-selected', 'false');
    expect(get('p2')).toBeVisible();
    expect(get('p1')).not.toBeVisible();
    expect(get('t2').tabIndex).toBe(0);
  });

  it('moves with the arrow keys, Home and End, wrapping around', () => {
    const get = tabsPage();
    startLandingControls();
    get('t1').focus();
    fireEvent.keyDown(get('t1'), { key: 'ArrowRight' });
    expect(get('t2')).toHaveFocus();
    expect(get('p2')).toBeVisible();
    fireEvent.keyDown(get('t2'), { key: 'ArrowRight' });
    expect(get('t0')).toHaveFocus();
    fireEvent.keyDown(get('t0'), { key: 'ArrowLeft' });
    expect(get('t2')).toHaveFocus();
    fireEvent.keyDown(get('t2'), { key: 'Home' });
    expect(get('t0')).toHaveFocus();
    fireEvent.keyDown(get('t0'), { key: 'End' });
    expect(get('t2')).toHaveFocus();
  });
});

describe('picking a card', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('presses its toggle and lights only its code lines', () => {
    document.body.innerHTML = `
      <div data-pick-root id="root">
        <button data-pick="svc" aria-pressed="true">Select Order Service</button>
        <button data-pick="odb" aria-pressed="false">Select Orders DB</button>
        <div data-ref="svc" data-on id="a"></div>
        <div data-ref="odb" id="b"></div>
      </div>`;
    startLandingControls();
    const [svc, odb] = document.querySelectorAll('button');
    if (odb === undefined || svc === undefined) throw new Error('buttons');
    fireEvent.click(odb);
    expect(odb).toHaveAttribute('aria-pressed', 'true');
    expect(svc).toHaveAttribute('aria-pressed', 'false');
    expect(document.getElementById('a')).not.toHaveAttribute('data-on');
    expect(document.getElementById('b')).toHaveAttribute('data-on');
    const root = document.getElementById('root');
    if (root !== null) pick(root, 'svc');
    expect(document.getElementById('a')).toHaveAttribute('data-on');
  });
});
