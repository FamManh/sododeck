import { isApplePlatform } from '../../lib/features';

/**
 * The editor's keyboard shortcuts as users see them (018 R9, FR-039): one table for the rail and
 * island tooltips and the "Keyboard shortcuts" dialog, so labels and keys cannot drift. The key
 * handling itself lives in `use-canvas-shortcuts.ts`, `use-shell-shortcuts.ts` and the flow hooks.
 */
export type ShortcutSection = 'Canvas' | 'Tools' | 'Panels' | 'Flows' | 'JSON';

export interface Shortcut {
  id: string;
  label: string;
  section: ShortcutSection;
  keys: { apple: string; other: string };
}

const same = (keys: string) => ({ apple: keys, other: keys });
const mod = (apple: string, other: string) => ({ apple, other });

export const SHORTCUTS = [
  // Tools (rail)
  { id: 'select', label: 'Select', section: 'Tools', keys: same('V') },
  { id: 'add-component', label: 'Add component', section: 'Tools', keys: same('C') },
  { id: 'add-kind', label: 'Add a kind (palette open)', section: 'Tools', keys: same('1–6') },
  { id: 'sticky', label: 'Sticky note', section: 'Tools', keys: same('S') },
  { id: 'note-here', label: 'Add a note at the pointer', section: 'Tools', keys: same('N') },
  { id: 'group', label: 'Group', section: 'Tools', keys: same('G') },
  { id: 'connector', label: 'Connector', section: 'Tools', keys: same('L') },
  { id: 'connect', label: 'Connect the focused card', section: 'Tools', keys: same('C') },
  { id: 'undo', label: 'Undo', section: 'Tools', keys: mod('⌘Z', 'Ctrl+Z') },
  { id: 'redo', label: 'Redo', section: 'Tools', keys: mod('⇧⌘Z', 'Ctrl+Y') },
  // Panels
  { id: 'outline', label: 'Outline', section: 'Panels', keys: mod('⌥1', 'Alt+1') },
  { id: 'flows', label: 'Flows & features', section: 'Panels', keys: mod('⌥2', 'Alt+2') },
  { id: 'search', label: 'Search', section: 'Panels', keys: mod('⌘K', 'Ctrl+K') },
  { id: 'problems', label: 'Next problem', section: 'Panels', keys: mod('⌘.', 'Ctrl+.') },
  {
    id: 'previous-problem',
    label: 'Previous problem',
    section: 'Panels',
    keys: mod('⇧⌘.', 'Ctrl+Shift+.'),
  },
  { id: 'details', label: 'Details drawer', section: 'Panels', keys: mod('⌘⇧D', 'Ctrl+Shift+D') },
  { id: 'open-details', label: 'Open details', section: 'Panels', keys: same('Enter') },
  { id: 'hide-ui', label: 'Hide UI', section: 'Panels', keys: mod('⌘\\', 'Ctrl+\\') },
  { id: 'regions', label: 'Next region', section: 'Panels', keys: same('F6') },
  { id: 'previous-region', label: 'Previous region', section: 'Panels', keys: same('⇧F6') },
  { id: 'help', label: 'Keyboard shortcuts', section: 'Panels', keys: same('?') },
  { id: 'save', label: 'Save now', section: 'Panels', keys: mod('⌘S', 'Ctrl+S') },
  // Canvas
  { id: 'move-focus', label: 'Move between cards', section: 'Canvas', keys: same('Arrows') },
  { id: 'next-connection', label: 'Next connection', section: 'Canvas', keys: same('E') },
  { id: 'collapse', label: 'Collapse or expand a group', section: 'Canvas', keys: same('Space') },
  { id: 'focus-mode', label: 'Focus mode', section: 'Canvas', keys: same('F') },
  { id: 'select-all', label: 'Select all', section: 'Canvas', keys: mod('⌘A', 'Ctrl+A') },
  { id: 'delete', label: 'Delete', section: 'Canvas', keys: same('Delete') },
  { id: 'fit', label: 'Fit diagram', section: 'Canvas', keys: same('⇧1') },
  { id: 'fit-selection', label: 'Fit selection', section: 'Canvas', keys: same('⇧2') },
  { id: 'zoom-in', label: 'Zoom in', section: 'Canvas', keys: mod('⌘+', 'Ctrl++') },
  { id: 'zoom-out', label: 'Zoom out', section: 'Canvas', keys: mod('⌘−', 'Ctrl+−') },
  { id: 'minimap', label: 'Minimap', section: 'Canvas', keys: same('M') },
  { id: 'escape', label: 'Clear selection or close', section: 'Canvas', keys: same('Esc') },
  // Flows
  { id: 'filter-flows', label: 'Filter flows', section: 'Flows', keys: same('/') },
  { id: 'step', label: 'Previous / next step', section: 'Flows', keys: same('← / →') },
  { id: 'alternative', label: 'Switch branch at a fork', section: 'Flows', keys: same('↑ / ↓') },
  { id: 'branch', label: 'Branch after a step (recording)', section: 'Flows', keys: same('B') },
  // JSON
  { id: 'json', label: 'Show or hide JSON', section: 'JSON', keys: mod('⌘J', 'Ctrl+J') },
] as const satisfies readonly Shortcut[];

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];

export const SHORTCUT_SECTIONS: readonly ShortcutSection[] = [
  'Tools',
  'Panels',
  'Canvas',
  'Flows',
  'JSON',
];

const BY_ID = new Map<string, Shortcut>(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

/** The keys of a shortcut for this platform, e.g. "⌥1" on a Mac, "Alt+1" elsewhere. */
export function shortcutLabel(id: ShortcutId, apple = isApplePlatform()): string {
  const shortcut = BY_ID.get(id);
  if (shortcut === undefined) return '';
  return apple ? shortcut.keys.apple : shortcut.keys.other;
}
