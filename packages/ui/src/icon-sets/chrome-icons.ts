/**
 * Icons the export draws as chrome (not in the picker): export key → lucide icon name. The
 * generator copies their geometry next to the catalog's, so the export has one geometry table.
 */
export const CHROME_ICONS = {
  rules: 'table',
  children: 'layers',
  sticky: 'sticky-note',
  chevron: 'chevron-down',
  enter: 'corner-down-left',
  'status-circle': 'circle',
  'status-circle-dashed': 'circle-dashed',
  'status-circle-dot': 'circle-dot',
  'status-circle-check': 'circle-check',
  'status-eye': 'eye',
  'status-door-open': 'door-open',
  date: 'calendar',
  'date-range': 'calendar-range',
  link: 'link',
  // Table rows in the export (041).
  'primary-key': 'key-round',
  'foreign-key': 'link-2',
  indexes: 'list-ordered',
  // Note icon after a table or column name (064).
  note: 'notebook-text',
} as const;

export type ChromeIconKey = keyof typeof CHROME_ICONS;
