import { FileCode, FileDown, Workflow } from 'lucide-react';

import { COPY } from '../../lib/landing/copy';
import { IconTile } from './icon-tile';

const ICONS = [FileDown, Workflow, FileCode] as const;

/** The three Database promises under the schema visual. */
export function DatabasePoints() {
  return (
    <ul className="grid grid-cols-1 gap-4 desk:mt-12 desk:grid-cols-3 desk:gap-8">
      {COPY.database.points.map((point, i) => (
        <li key={point} className="flex items-center gap-3.5 text-[15.5px] font-medium text-ink">
          <IconTile icon={ICONS[i] ?? FileCode} />
          {point}
        </li>
      ))}
    </ul>
  );
}
