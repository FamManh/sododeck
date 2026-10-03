import type { ReactNode } from 'react';

interface BreakpointViewsProps {
  desktop: ReactNode;
  tablet: ReactNode;
  phone: ReactNode;
}

/**
 * The design draws some visuals differently per breakpoint (other crops, other worlds). All three
 * are in the static page; CSS shows one (phone < 700px ≤ tablet < 1280px ≤ desktop). A hidden view
 * never intersects the viewport, so its animation never starts.
 */
export function BreakpointViews({ desktop, tablet, phone }: BreakpointViewsProps) {
  return (
    <>
      <div className="hidden desk:block">{desktop}</div>
      <div className="hidden tab:max-desk:block">{tablet}</div>
      <div className="tab:hidden">{phone}</div>
    </>
  );
}
