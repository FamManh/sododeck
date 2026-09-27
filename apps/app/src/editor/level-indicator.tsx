import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';

import { LEVEL_MID_ZOOM, LEVEL_NAMES, LEVELS, type Level } from './levels';
import type { Scope } from './visible-graph';

export function LevelIndicator({
  level,
  scope,
  onZoomTo,
}: {
  level: Level;
  scope: Scope;
  onZoomTo: (zoom: number) => void;
}) {
  const lockedToComponent = scope.node !== null;
  const checked = lockedToComponent ? 'component' : level;
  const filled = LEVELS.indexOf(checked) + 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-haspopup="menu"
          aria-label={`Level: ${LEVEL_NAMES[checked]}`}
        >
          <span aria-hidden className="flex items-end gap-0.5">
            {LEVELS.map((entry, index) => (
              <span
                key={entry}
                data-testid="level-bar"
                data-filled={index < filled ? '' : undefined}
                className={[
                  'block w-1 rounded-full bg-surface-3',
                  index < filled ? 'bg-primary' : 'bg-surface-3',
                  index === 0 ? 'h-2' : index === 1 ? 'h-3' : index === 2 ? 'h-4' : 'h-5',
                ].join(' ')}
              />
            ))}
          </span>
          {LEVEL_NAMES[checked]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Level" align="end">
        <DropdownMenuRadioGroup
          value={checked}
          onValueChange={(value) => {
            if (lockedToComponent && value !== 'component') return;
            if (
              value === 'landscape' ||
              value === 'system' ||
              value === 'container' ||
              value === 'component'
            ) {
              onZoomTo(LEVEL_MID_ZOOM[value]);
            }
          }}
        >
          {LEVELS.map((entry) => (
            <DropdownMenuRadioItem
              key={entry}
              value={entry}
              disabled={lockedToComponent && entry !== 'component'}
            >
              {LEVEL_NAMES[entry]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
