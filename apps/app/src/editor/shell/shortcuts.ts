import { isApplePlatform } from '../../lib/features';

/**
 * The editor's keyboard shortcuts as users see them (018 R9, FR-039): one table for the rail and
 * island tooltips and the "Keyboard shortcuts" dialog, so labels and keys cannot drift. The key
 * handling itself lives in `use-canvas-shortcuts.ts`, `use-shell-shortcuts.ts` and the flow hooks.
 */
export type ShortcutSection =
  'Canvas' | 'Tools' | 'Panels' | 'Quick edit' | 'Editing' | 'Flows' | 'JSON';

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
  { id: 'hand', label: 'Hand (pan)', section: 'Tools', keys: same('H') },
  { id: 'add-component', label: 'Add component', section: 'Tools', keys: same('C') },
  { id: 'add-kind', label: 'Add a type (Add open)', section: 'Tools', keys: same('1–9') },
  { id: 'sticky', label: 'Sticky note', section: 'Tools', keys: same('S') },
  { id: 'note-here', label: 'Add a note at the pointer', section: 'Tools', keys: same('N') },
  { id: 'group', label: 'Group', section: 'Tools', keys: mod('⌘G', 'Ctrl+G') },
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
  { id: 'zoom-fit', label: 'Zoom to fit', section: 'Canvas', keys: mod('⌘0', 'Ctrl+0') },
  // Quick edit (019): on-card title, selection toolbar, context menu
  { id: 'rename', label: 'Rename', section: 'Quick edit', keys: same('F2') },
  { id: 'rename-pointer', label: 'Rename', section: 'Quick edit', keys: same('Double-click') },
  {
    id: 'save-and-add',
    label: 'Save and add another',
    section: 'Quick edit',
    keys: mod('⌘⏎', 'Ctrl+Enter'),
  },
  {
    id: 'focus-toolbar',
    label: 'Focus the selection toolbar',
    section: 'Quick edit',
    keys: mod('⌘E', 'Ctrl+E'),
  },
  { id: 'context-menu', label: 'Open the context menu', section: 'Quick edit', keys: same('⇧F10') },
  { id: 'copy-json', label: 'Copy JSON', section: 'Quick edit', keys: mod('⇧⌘C', 'Ctrl+Shift+C') },
  { id: 'ungroup', label: 'Ungroup', section: 'Quick edit', keys: mod('⇧⌘G', 'Ctrl+Shift+G') },
  {
    id: 'connection-protocol',
    label: 'Connection protocol',
    section: 'Quick edit',
    keys: same('P'),
  },
  // Editing (016): clipboard, align, nudge, and keys held during a drag
  { id: 'copy', label: 'Copy', section: 'Editing', keys: mod('⌘C', 'Ctrl+C') },
  { id: 'cut', label: 'Cut', section: 'Editing', keys: mod('⌘X', 'Ctrl+X') },
  { id: 'paste', label: 'Paste', section: 'Editing', keys: mod('⌘V', 'Ctrl+V') },
  { id: 'duplicate', label: 'Duplicate', section: 'Editing', keys: mod('⌘D', 'Ctrl+D') },
  { id: 'align-left', label: 'Align left', section: 'Editing', keys: mod('⌥A', 'Alt+A') },
  { id: 'align-right', label: 'Align right', section: 'Editing', keys: mod('⌥D', 'Alt+D') },
  { id: 'align-top', label: 'Align top', section: 'Editing', keys: mod('⌥W', 'Alt+W') },
  { id: 'align-bottom', label: 'Align bottom', section: 'Editing', keys: mod('⌥S', 'Alt+S') },
  { id: 'nudge', label: 'Nudge 1 px', section: 'Editing', keys: mod('⌥ Arrows', 'Alt+Arrows') },
  {
    id: 'nudge-10',
    label: 'Nudge 10 px',
    section: 'Editing',
    keys: mod('⌥⇧ Arrows', 'Alt+Shift+Arrows'),
  },
  {
    id: 'drag-no-snap',
    label: 'Drag without snapping',
    section: 'Editing',
    keys: mod('Hold ⌘', 'Hold Ctrl'),
  },
  { id: 'drag-lock-axis', label: 'Lock the drag axis', section: 'Editing', keys: same('Hold ⇧') },
  {
    id: 'drag-duplicate',
    label: 'Duplicate while dragging',
    section: 'Editing',
    keys: mod('⌥ + drag', 'Alt + drag'),
  },
  {
    id: 'drop-without-group',
    label: 'Drop without changing the group',
    section: 'Editing',
    keys: mod('⌥ + drop', 'Alt + drop'),
  },
  {
    id: 'resize-card',
    label: 'Resize the selected card',
    section: 'Editing',
    keys: mod('⌘⇧ Arrows', 'Ctrl+Shift+Arrows'),
  },
  {
    id: 'move-segment',
    label: "Move a connector's middle segment",
    section: 'Editing',
    keys: mod('⌥ Arrows', 'Alt+Arrows'),
  },
  {
    id: 'move-segment-10',
    label: "Move a connector's middle segment 10 px",
    section: 'Editing',
    keys: mod('⌥⇧ Arrows', 'Alt+Shift+Arrows'),
  },
  {
    id: 'reset-route',
    label: 'Reset the route to automatic, while moving the segment',
    section: 'Editing',
    keys: same('R'),
  },
  {
    id: 'resize-no-snap',
    label: 'Resize without snapping',
    section: 'Editing',
    keys: mod('Hold ⌘', 'Hold Ctrl'),
  },
  {
    id: 'resize-ratio',
    label: 'Keep the aspect ratio while resizing',
    section: 'Editing',
    keys: same('Hold ⇧'),
  },
  {
    id: 'resize-centre',
    label: 'Resize from the centre',
    section: 'Editing',
    keys: mod('Hold ⌥', 'Hold Alt'),
  },
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
  'Quick edit',
  'Editing',
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
