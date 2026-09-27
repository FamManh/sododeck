import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './ui-store';

const initial = useUiStore.getState();

describe('ui store', () => {
  beforeEach(() => {
    useUiStore.setState(initial, true);
  });

  it('selects and clears', () => {
    useUiStore.getState().select('order-svc');
    expect(useUiStore.getState().selectedId).toBe('order-svc');
    useUiStore.getState().select(null);
    expect(useUiStore.getState().selectedId).toBeNull();
  });

  it('toggles the JSON panel', () => {
    expect(useUiStore.getState().jsonPanelOpen).toBe(true);
    useUiStore.getState().toggleJsonPanel();
    expect(useUiStore.getState().jsonPanelOpen).toBe(false);
  });
});
