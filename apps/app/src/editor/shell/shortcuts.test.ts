import { describe, expect, it } from 'vitest';

import { SHORTCUT_SECTIONS, SHORTCUTS, shortcutLabel, type ShortcutId } from './shortcuts';

describe('SHORTCUTS', () => {
  it('has unique ids', () => {
    const ids = SHORTCUTS.map((shortcut) => shortcut.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses each key once per section, except C (palette or connect, §g-49)', () => {
    for (const section of SHORTCUT_SECTIONS) {
      const keys = SHORTCUTS.filter((s) => s.section === section)
        .map((s) => s.keys.apple)
        .filter((key) => key !== 'C');
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

describe('shortcutLabel', () => {
  it('returns the platform keys', () => {
    expect(shortcutLabel('outline', true)).toBe('⌥1');
    expect(shortcutLabel('outline', false)).toBe('Alt+1');
    expect(shortcutLabel('json', true)).toBe('⌘J');
    expect(shortcutLabel('json', false)).toBe('Ctrl+J');
    expect(shortcutLabel('select', false)).toBe('V');
  });
});
