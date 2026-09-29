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
  | 'fallback'
  | 'rules'
  | 'children'
  | 'sticky',
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
};
