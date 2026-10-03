import { Bookmark, LayoutGrid, Search } from 'lucide-react';

import { COPY } from '../../lib/landing/copy';
import { IconTile } from './icon-tile';

const ICONS = [Bookmark, LayoutGrid, Search] as const;

/** Saved views, auto-layout and search, under the Explore visual. */
export function ExploreCaptions() {
  return (
    <ul className="mt-2 grid grid-cols-1 gap-5 desk:grid-cols-3 desk:gap-8">
      {COPY.explore.captions.map(([title, body], i) => (
        <li key={title} className="flex items-start gap-3.5">
          <IconTile icon={ICONS[i] ?? Search} />
          <div className="flex flex-col gap-1">
            <span className="text-[15.5px] font-medium text-ink">{title}</span>
            <span className="text-[14.5px] leading-normal text-pretty text-ink-secondary">
              {body}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
