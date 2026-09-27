import type { EdgeFlowStyle } from './flows/flow-overlay';

/**
 * Stroke of a flow mark (006 research R6). Never color alone: error and invalid are dashed and
 * carry an icon, candidates and the preview are dotted.
 */
export const FLOW_STROKES: Readonly<
  Record<EdgeFlowStyle, { stroke: string; width: number; dash?: string }>
> = {
  path: { stroke: 'var(--color-primary)', width: 2 },
  error: { stroke: 'var(--color-clay-ink)', width: 2, dash: '6 4' },
  candidate: { stroke: 'var(--color-primary)', width: 1.5, dash: '2 4' },
  preview: { stroke: 'var(--color-primary)', width: 2.5, dash: '2 4' },
  invalid: { stroke: 'var(--color-clay-ink)', width: 2, dash: '6 4' },
};
