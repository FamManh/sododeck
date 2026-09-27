import type * as React from 'react';

/** One gallery section: an anchored heading plus the samples. */
export function GallerySection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="flex scroll-mt-20 flex-col gap-4 rounded-card border border-hairline bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-title-lg">
          {title}
        </h2>
        {description && <p className="text-body text-ink-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}
