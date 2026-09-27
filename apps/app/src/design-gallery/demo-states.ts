/**
 * Static stand-ins for pointer/keyboard states, so reviewers can compare hover and focus
 * looks without interacting. Applied to elements marked `data-demo-state`.
 */
export const DEMO_FOCUS = 'outline-2 outline-solid outline-offset-2 outline-primary';

export const DEMO_HOVER = {
  primary: 'bg-primary-hover',
  secondary: 'bg-surface-2',
  ghost: 'bg-surface-2 text-ink',
  chip: 'bg-surface-3 text-ink',
  toggle: 'bg-surface-2',
  field: 'border-border',
} as const;
