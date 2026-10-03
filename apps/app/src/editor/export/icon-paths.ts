import { resolveTypeId } from '@sododeck/ui/lib/icons';

/** Geometry copied from lucide-react v1.48.0 (ISC). Drift is checked against the installed icons. */
export type IconNode = readonly (readonly [
  tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse',
  attrs: Readonly<Record<string, string | number>>,
])[];
export const ICON_PATHS: Record<
  | 'client'
  | 'gateway'
  | 'service'
  | 'queue'
  | 'database'
  | 'external'
  | 'component'
  | 'task'
  | 'decision'
  | 'document'
  | 'warehouse'
  | 'truck-route'
  | 'issue'
  | 'fallback'
  | 'rules'
  | 'children'
  | 'sticky'
  | 'chevron'
  | 'enter'
  | 'status-circle'
  | 'status-circle-dashed'
  | 'status-circle-dot'
  | 'status-circle-check'
  | 'status-eye'
  | 'status-door-open'
  | 'date'
  | 'date-range'
  | 'link',
  IconNode
> = {
  client: [
    ['path', { d: 'M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8' }],
    ['path', { d: 'M10 19v-3.96 3.15' }],
    ['path', { d: 'M7 19h5' }],
    ['rect', { width: '6', height: '10', x: '16', y: '12', rx: '2' }],
  ],
  gateway: [
    ['rect', { width: '20', height: '8', x: '2', y: '14', rx: '2' }],
    ['path', { d: 'M6.01 18H6' }],
    ['path', { d: 'M10.01 18H10' }],
    ['path', { d: 'M15 10v4' }],
    ['path', { d: 'M17.84 7.17a4 4 0 0 0-5.66 0' }],
    ['path', { d: 'M20.66 4.34a8 8 0 0 0-11.31 0' }],
  ],
  service: [
    [
      'path',
      {
        d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
      },
    ],
    ['path', { d: 'm3.3 7 8.7 5 8.7-5' }],
    ['path', { d: 'M12 22V12' }],
  ],
  queue: [
    ['path', { d: 'M8 3 4 7l4 4' }],
    ['path', { d: 'M4 7h16' }],
    ['path', { d: 'm16 21 4-4-4-4' }],
    ['path', { d: 'M20 17H4' }],
  ],
  database: [
    ['ellipse', { cx: '12', cy: '5', rx: '9', ry: '3' }],
    ['path', { d: 'M3 5V19A9 3 0 0 0 21 19V5' }],
    ['path', { d: 'M3 12A9 3 0 0 0 21 12' }],
  ],
  external: [['path', { d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' }]],
  component: [
    [
      'path',
      {
        d: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z',
      },
    ],
  ],
  task: [
    ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }],
    ['path', { d: 'm16 9-5.5 5.5L8 12' }],
  ],
  decision: [
    [
      'path',
      {
        d: 'M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z',
      },
    ],
  ],
  document: [
    [
      'path',
      {
        d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
      },
    ],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'M10 9H8' }],
    ['path', { d: 'M16 13H8' }],
    ['path', { d: 'M16 17H8' }],
  ],
  warehouse: [
    ['path', { d: 'M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11' }],
    [
      'path',
      {
        d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z',
      },
    ],
    ['path', { d: 'M6 13h12' }],
    ['path', { d: 'M6 17h12' }],
  ],
  'truck-route': [
    ['path', { d: 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2' }],
    ['path', { d: 'M15 18H9' }],
    [
      'path',
      {
        d: 'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14',
      },
    ],
    ['circle', { cx: '17', cy: '18', r: '2' }],
    ['circle', { cx: '7', cy: '18', r: '2' }],
  ],
  issue: [
    [
      'path',
      {
        d: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z',
      },
    ],
    ['path', { d: 'M13 5v2' }],
    ['path', { d: 'M13 17v2' }],
    ['path', { d: 'M13 11v2' }],
  ],
  fallback: [
    [
      'path',
      {
        d: 'M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z',
      },
    ],
    ['rect', { x: '3', y: '14', width: '7', height: '7', rx: '1' }],
    ['circle', { cx: '17.5', cy: '17.5', r: '3.5' }],
  ],
  rules: [
    ['path', { d: 'M12 3v18' }],
    ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }],
    ['path', { d: 'M3 9h18' }],
    ['path', { d: 'M3 15h18' }],
  ],
  children: [
    [
      'path',
      {
        d: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z',
      },
    ],
    ['path', { d: 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12' }],
    ['path', { d: 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17' }],
  ],
  sticky: [
    [
      'path',
      {
        d: 'M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z',
      },
    ],
    ['path', { d: 'M15 3v5a1 1 0 0 0 1 1h5' }],
  ],
  chevron: [['path', { d: 'm6 9 6 6 6-6' }]],
  enter: [
    ['path', { d: 'M20 4v7a4 4 0 0 1-4 4H4' }],
    ['path', { d: 'm9 10-5 5 5 5' }],
  ],
  // Typed field chips and rows (032).
  'status-circle': [['circle', { cx: 12, cy: 12, r: 10 }]],
  'status-circle-dashed': [
    ['path', { d: 'M10.1 2.182a10 10 0 0 1 3.8 0' }],
    ['path', { d: 'M13.9 21.818a10 10 0 0 1-3.8 0' }],
    ['path', { d: 'M17.609 3.721a10 10 0 0 1 2.69 2.7' }],
    ['path', { d: 'M2.182 13.9a10 10 0 0 1 0-3.8' }],
    ['path', { d: 'M20.279 17.609a10 10 0 0 1-2.7 2.69' }],
    ['path', { d: 'M21.818 10.1a10 10 0 0 1 0 3.8' }],
    ['path', { d: 'M3.721 6.391a10 10 0 0 1 2.7-2.69' }],
    ['path', { d: 'M6.391 20.279a10 10 0 0 1-2.69-2.7' }],
  ],
  'status-circle-dot': [
    ['circle', { cx: 12, cy: 12, r: 1 }],
    ['circle', { cx: 12, cy: 12, r: 10 }],
  ],
  'status-circle-check': [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['path', { d: 'm16 9-5.5 5.5L8 12' }],
  ],
  'status-eye': [
    [
      'path',
      {
        d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0',
      },
    ],
    ['circle', { cx: 12, cy: 12, r: 3 }],
  ],
  'status-door-open': [
    ['path', { d: 'M10 21H2' }],
    ['path', { d: 'M10 3H7a2 2 0 00-2 2v16' }],
    ['path', { d: 'M14 12h.01' }],
    [
      'path',
      { d: 'M19 21V5a2 2 0 00-1.675-1.974l-6.163-1.013A1 1 0 0010 3v18a1 1 0 001.124.992z' },
    ],
    ['path', { d: 'M22 21h-3' }],
  ],
  date: [
    ['path', { d: 'M8 2v3' }],
    ['path', { d: 'M16 2v3' }],
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ['path', { d: 'M3 9h18' }],
  ],
  'date-range': [
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ['path', { d: 'M16 2v3' }],
    ['path', { d: 'M3 9h18' }],
    ['path', { d: 'M8 2v3' }],
    ['path', { d: 'M17 13h-6' }],
    ['path', { d: 'M13 17H7' }],
    ['path', { d: 'M7 13h.01' }],
    ['path', { d: 'M17 17h.01' }],
  ],
  link: [
    ['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }],
    ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }],
  ],
};

export type IconKey = keyof typeof ICON_PATHS;

/** The export icon of a card type id; an id this version has no icon for draws the fallback. */
export function typeIconKey(type: string): IconKey {
  const resolved = resolveTypeId(type);
  return resolved !== null && Object.hasOwn(ICON_PATHS, resolved)
    ? (resolved as IconKey)
    : 'fallback';
}
