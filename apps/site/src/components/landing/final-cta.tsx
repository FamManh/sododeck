import { SquareTerminal } from 'lucide-react';

import { COPY } from '../../lib/landing/copy';
import { APP_URL, SKILL_URL } from '../../site';
import { CtaButton } from './cta-button';
import { GUTTERS } from './landing-section';

/** The closing call to action: a prompt or a blank canvas. */
export function FinalCta() {
  return (
    <section
      id="start"
      className={`${GUTTERS} border-t border-hairline py-16 tab:py-[88px] desk:py-28`}
    >
      <div className="flex flex-col items-start gap-[18px] tab:items-center tab:text-center">
        <h2 className="max-w-[720px] text-[30.8px] leading-[1.18] font-medium tracking-[-0.015em] text-balance text-ink tab:text-[35.2px] tab:leading-[1.15] tab:tracking-[-0.02em] desk:text-[41.8px] desk:leading-[1.12] desk:tracking-[-0.025em]">
          {COPY.final.title}
        </h2>
        <p className="max-w-[560px] text-marketing-lead-phone text-pretty text-ink-secondary tab:text-marketing-lead-tablet desk:text-marketing-lead">
          {COPY.final.body}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 tab:justify-center">
          <CtaButton href={APP_URL} label={COPY.cta.start} />
          <CtaButton
            href={SKILL_URL}
            label={COPY.cta.skill}
            kind="secondary"
            icon={SquareTerminal}
          />
        </div>
      </div>
    </section>
  );
}
