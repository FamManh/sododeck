import { Braces, ShieldCheck, UserRoundX, WifiOff } from 'lucide-react';

import { COPY } from '../../lib/landing/copy';
import { IconTile } from './icon-tile';
import { GUTTERS } from './landing-section';

const ICONS = [UserRoundX, WifiOff, Braces, ShieldCheck] as const;

/** Four promises under the hero (no performance numbers until 037 has a baseline, L4). */
export function ProofStrip() {
  return (
    <section aria-label="What you get" className={GUTTERS}>
      <ul className="grid grid-cols-2 gap-4 border-y border-hairline py-6 tab:gap-6 tab:py-8 desk:grid-cols-4">
        {COPY.proof.map((promise, i) => (
          <li
            key={promise}
            className="flex items-center gap-3 text-[14.5px] font-medium text-ink tab:text-[15.5px]"
          >
            <IconTile icon={ICONS[i] ?? ShieldCheck} />
            {promise}
          </li>
        ))}
      </ul>
    </section>
  );
}
