import { describe, expect, it } from 'vitest';

import { SHORTCUT_SECTIONS, SHORTCUTS, shortcutLabel, type ShortcutId } from './shortcuts';

describe('SHORTCUTS', () => {
  it('has unique ids', () => {
    const ids = SHORTCUTS.map((shortcut) => shortcut.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses each key once per section, except keys shared by mutually exclusive gestures (§g-49, 017)', () => {
    // C: palette or connect. Hold ⌘ / Hold ⇧ / Hold ⌥ and ⌥ Arrows / ⌥⇧ Arrows: drag, resize and
    // segment gestures reuse the same modifier meaning, but only one gesture runs at a time.
    const shared = new Set(['C', 'Hold ⌘', 'Hold ⇧', 'Hold ⌥', '⌥ Arrows', '⌥⇧ Arrows']);
    for (const section of SHORTCUT_SECTIONS) {
      const keys = SHORTCUTS.filter((s) => s.section === section)
        .map((s) => s.keys.apple)
        .filter((key) => !shared.has(key));
      expect(new Set(keys).size, section).toBe(keys.length);
    }
  });

  it('covers every rail item and every key added by 018 (FR-039)', () => {
    const required: ShortcutId[] = [
      'select',
      'add-component',
      'sticky',
      'group',
      'connector',
      'outline',
      'flows',
      'search',
      'problems',
      'regions',
      'previous-region',
      'hide-ui',
      'json',
      'details',
      'add-kind',
      'fit',
      'fit-selection',
      'minimap',
      'help',
    ];
    const ids = new Set<string>(SHORTCUTS.map((s) => s.id));
    for (const id of required) expect(ids.has(id), id).toBe(true);
  });

  it('lists every key added by 019 in the Quick edit section (FR-045)', () => {
    const quick = SHORTCUTS.filter((s) => s.section === 'Quick edit').map((s) => s.keys.apple);
    expect(quick).toEqual(
      expect.arrayContaining(['F2', 'Double-click', '⌘⏎', '⌘E', '⇧F10', '⇧⌘C', '⇧⌘G', 'P']),
    );
    expect(SHORTCUT_SECTIONS).toContain('Quick edit');
  });
});

describe('Editing section (016, 017)', () => {
  it('lists every editing shortcut of the contract', () => {
    const editing = SHORTCUTS.filter((s) => s.section === 'Editing').map((s) => s.id);
    expect(editing).toEqual([
      'copy',
      'cut',
      'paste',
      'duplicate',
      'align-left',
      'align-right',
      'align-top',
      'align-bottom',
      'nudge',
      'nudge-10',
      'drag-no-snap',
      'drag-lock-axis',
      'drag-duplicate',
      'drop-without-group',
      'resize-card',
      'move-bend',
      'move-bend-1',
      'reset-route',
      'resize-no-snap',
      'resize-ratio',
      'resize-centre',
      'lock',
    ]);
    expect(SHORTCUT_SECTIONS).toContain('Editing');
  });

  it('labels the keys per platform, and Group is ⌘G', () => {
    expect(shortcutLabel('copy', true)).toBe('⌘C');
    expect(shortcutLabel('paste', false)).toBe('Ctrl+V');
    expect(shortcutLabel('duplicate', true)).toBe('⌘D');
    expect(shortcutLabel('align-left', true)).toBe('⌥A');
    expect(shortcutLabel('align-bottom', false)).toBe('Alt+S');
    expect(shortcutLabel('nudge-10', true)).toBe('⌥⇧ Arrows');
    expect(shortcutLabel('group', true)).toBe('⌘G');
    expect(shortcutLabel('group', false)).toBe('Ctrl+G');
    expect(shortcutLabel('ungroup', true)).toBe('⇧⌘G');
  });

  it('labels the card resize and bend keys (017, 022)', () => {
    expect(shortcutLabel('resize-card', true)).toBe('⌘⇧ Arrows');
    expect(shortcutLabel('resize-card', false)).toBe('Ctrl+Shift+Arrows');
    expect(shortcutLabel('move-bend', true)).toBe('Arrows');
    expect(shortcutLabel('move-bend-1', true)).toBe('⇧ Arrows');
    expect(shortcutLabel('reset-route', true)).toBe('R');
  });
});

describe('shortcutLabel', () => {
  it('returns the platform keys', () => {
    expect(shortcutLabel('outline', true)).toBe('⌥1');
    expect(shortcutLabel('outline', false)).toBe('Alt+1');
    expect(shortcutLabel('json', true)).toBe('⌘J');
    expect(shortcutLabel('json', false)).toBe('Ctrl+J');
    expect(shortcutLabel('select', false)).toBe('V');
  });
});
