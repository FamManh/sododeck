import type { LucideIcon } from 'lucide-react';

interface CtaButtonProps {
  href: string;
  label: string;
  kind?: 'primary' | 'secondary';
  size?: 'default' | 'small';
  icon?: LucideIcon;
}

/**
 * A marketing button: Deck orange (or surface) with a lip that lifts on hover and drops when
 * pressed (styles in `landing.css`). Text on orange is dark (DESIGN.md "On Primary").
 */
export function CtaButton({
  href,
  label,
  kind = 'primary',
  size = 'default',
  icon: Icon,
}: CtaButtonProps) {
  const classes = ['ld-btn', `ld-btn-${kind}`, size === 'small' ? 'ld-btn-sm' : null]
    .filter(Boolean)
    .join(' ');
  return (
    <a href={href} className={classes}>
      {Icon !== undefined && <Icon aria-hidden size={size === 'small' ? 15 : 17} strokeWidth={2} />}
      {label}
    </a>
  );
}
