import type * as React from 'react';

/** A labelled row of samples inside a gallery section. */
export function SampleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
      <span className="text-micro text-ink-muted uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
