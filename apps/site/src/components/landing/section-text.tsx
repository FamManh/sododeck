import type { ReactNode } from 'react';

interface SectionTextProps {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}

/** A section's eyebrow, headline and paragraph. */
export function SectionText({ eyebrow, title, body, children }: SectionTextProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-marketing-eyebrow text-ink-secondary uppercase">{eyebrow}</p>
      <h2 className="text-marketing-h2-phone text-balance text-ink tab:text-marketing-h2-tablet desk:text-marketing-h2">
        {title}
      </h2>
      <p className="max-w-[600px] text-marketing-body-phone text-pretty text-ink-secondary tab:text-marketing-body">
        {body}
      </p>
      {children}
    </div>
  );
}
