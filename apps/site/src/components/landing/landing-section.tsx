import type { ReactNode } from 'react';

interface LandingSectionProps {
  id: string;
  /** Text block (eyebrow, headline, body). */
  text: ReactNode;
  visual: ReactNode;
  /**
   * Desktop layout: the visual on the left or right of a 440px text column, or `full` (text above
   * a full-width visual). Tablet and phone always stack text, visual, then `after`.
   */
  layout: 'left' | 'right' | 'full';
  after?: ReactNode;
  className?: string;
}

/** The page grid: 1200px content on desktop, 32 / 24px gutters below. */
export const GUTTERS = 'px-6 tab:px-8 desk:px-[max(40px,calc((100%-1200px)/2))]';

/** One landing section (L1: each is one step a user takes). */
export function LandingSection({
  id,
  text,
  visual,
  layout,
  after,
  className,
}: LandingSectionProps) {
  const row = layout !== 'full';
  return (
    <section
      id={id}
      className={`${GUTTERS} scroll-mt-16 py-16 tab:py-[88px] desk:py-28 ${className ?? ''}`}
    >
      <div
        className={
          row
            ? 'flex flex-col gap-8 tab:gap-12 desk:flex-row desk:items-center desk:gap-16'
            : 'flex flex-col gap-8 tab:gap-12'
        }
      >
        <div
          className={
            row
              ? `desk:w-[440px] desk:flex-none ${layout === 'left' ? 'desk:order-2' : ''}`
              : 'max-w-[760px]'
          }
        >
          {text}
        </div>
        <div className={row ? 'min-w-0 desk:w-[696px] desk:flex-none' : 'min-w-0'}>{visual}</div>
        {after}
      </div>
    </section>
  );
}
