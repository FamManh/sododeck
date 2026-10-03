import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTION, type Selection } from '../../state/ui-store';
import { toolbarVariant } from './toolbar-variant';

const sel = (patch: Partial<Selection>): Selection => ({ ...EMPTY_SELECTION, ...patch });

describe('toolbarVariant', () => {
  it('has no toolbar for nothing or only stickies', () => {
    expect(toolbarVariant(EMPTY_SELECTION)).toBe('none');
    expect(toolbarVariant(sel({ stickies: ['s'] }))).toBe('none');
  });

  it('names each variant', () => {
    expect(toolbarVariant(sel({ nodes: ['a'] }))).toBe('component');
    expect(toolbarVariant(sel({ nodes: ['a', 'b'] }))).toBe('components');
    expect(toolbarVariant(sel({ edges: ['e'] }))).toBe('connection');
    expect(toolbarVariant(sel({ edges: ['e', 'f'] }))).toBe('connections');
    expect(toolbarVariant(sel({ groups: ['g'] }))).toBe('group');
    expect(toolbarVariant(sel({ nodes: ['a'], edges: ['e'] }))).toBe('mixed');
    expect(toolbarVariant(sel({ nodes: ['a'], stickies: ['s'] }))).toBe('mixed');
  });
});
