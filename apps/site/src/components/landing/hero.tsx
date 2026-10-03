import { Check, ShieldCheck, SquareTerminal } from 'lucide-react';

import { COPY } from '../../lib/landing/copy';
import { APP_URL, SKILL_URL } from '../../site';
import { BreakpointViews } from './breakpoint-views';
import { CtaButton } from './cta-button';
import { HeroVisual } from './hero-visual';

/** Step 1 · Generate: the headline (A, chosen), the two CTAs and the prompt → living map loop. */
export function Hero() {
  return (
    <section
      id="hero"
      className="flex flex-col gap-9 pt-10 pb-[72px] pl-6 tab:gap-12 tab:pt-16 tab:pl-8 desk:flex-row desk:items-center desk:gap-10 desk:pt-20 desk:pb-24 desk:pl-[max(40px,calc((100%-1200px)/2))]"
    >
      <div className="flex max-w-[620px] flex-col gap-6 pr-6 tab:pr-8 desk:w-[480px] desk:flex-none desk:pr-0">
        <h1 className="text-marketing-hero-phone text-balance text-ink tab:text-marketing-hero-tablet desk:text-marketing-hero">
          {COPY.hero.title}
        </h1>
        <p className="text-marketing-lead-phone text-pretty text-ink-secondary tab:text-marketing-lead-tablet desk:text-marketing-lead">
          {COPY.hero.lead}
        </p>
        <div className="mt-1 flex flex-wrap gap-3">
          <CtaButton href={APP_URL} label={COPY.cta.start} />
          <CtaButton
            href={SKILL_URL}
            label={COPY.cta.skill}
            kind="secondary"
            icon={SquareTerminal}
          />
        </div>
        <p className="flex items-center gap-2 text-[14px] text-ink-secondary">
          <ShieldCheck aria-hidden size={15} strokeWidth={2} className="flex-none" />
          {COPY.hero.small}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <BreakpointViews
          desktop={<HeroVisual breakpoint="desktop" />}
          tablet={<HeroVisual breakpoint="tablet" />}
          phone={<HeroVisual breakpoint="phone" />}
        />
        <ul className="mt-4 flex flex-col gap-2 pr-6 tab:flex-row tab:flex-wrap tab:gap-[22px] tab:pr-8">
          {COPY.hero.generate.map((item) => (
            <li key={item} className="flex items-center gap-[7px] text-[13.5px] text-ink-secondary">
              <Check aria-hidden size={14} strokeWidth={2.25} className="flex-none" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
