import type { ReactNode } from 'react';

/** The micro-label above an inspector field (DESIGN.md "section label"). */
export function FieldLabel({
  htmlFor,
  id,
  children,
}: {
  htmlFor?: string;
  id?: string;
  children: ReactNode;
}) {
  return htmlFor === undefined ? (
    <span id={id} className="text-micro text-ink-muted uppercase">
      {children}
    </span>
  ) : (
    <label id={id} htmlFor={htmlFor} className="text-micro text-ink-muted uppercase">
      {children}
    </label>
  );
}
