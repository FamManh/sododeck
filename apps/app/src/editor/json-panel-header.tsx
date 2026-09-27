import { Button } from '@sododeck/ui/components/button';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { Braces, ChevronDown, Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import type { JsonTab } from '../state/json-panel-prefs';
import { lineCountLabel } from './json-panel-view';

export interface JsonPanelHeaderProps {
  tab: JsonTab;
  onTabChange: (tab: JsonTab) => void;
  /** Visible Selection tab text (truncated) and its full accessible name. */
  selectionLabel: string;
  selectionFullLabel: string;
  /** Lines of the current tab's text; hidden when 0. */
  lineCount: number;
  /** Copy button (US4). */
  actions?: ReactNode;
  onCollapse: () => void;
}

const isTab = (value: string): value is JsonTab => value === 'deck' || value === 'selection';

/** 40 px header of the expanded JSON panel (contracts/json-panel-ui.md, screens 02 and 16). */
export function JsonPanelHeader({
  tab,
  onTabChange,
  selectionLabel,
  selectionFullLabel,
  lineCount,
  actions,
  onCollapse,
}: JsonPanelHeaderProps) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-hairline bg-surface pr-2 pl-4">
      <h2 className="flex items-center gap-2 text-body-sm font-medium text-ink">
        <Braces aria-hidden className="size-4 text-ink-secondary" />
        JSON
      </h2>
      <SegmentedControl
        aria-label="JSON view"
        value={tab}
        onValueChange={(value) => {
          if (isTab(value)) onTabChange(value);
        }}
      >
        <SegmentedControlItem
          value="selection"
          aria-label={selectionFullLabel}
          title={selectionFullLabel}
        >
          <span className="max-w-40 truncate">{selectionLabel}</span>
        </SegmentedControlItem>
        <SegmentedControlItem value="deck">Deck</SegmentedControlItem>
      </SegmentedControl>
      <p className="flex min-w-0 items-center gap-1.5 truncate text-caption text-ink-secondary">
        <Lock aria-hidden className="size-3.5 shrink-0" />
        Read-only · synced with canvas
      </p>
      <div className="flex-1" />
      {lineCount > 0 && (
        <span className="font-mono text-caption text-ink-secondary">
          {lineCountLabel(lineCount)}
        </span>
      )}
      {actions}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Collapse JSON panel"
        aria-expanded
        onClick={onCollapse}
      >
        <ChevronDown />
      </Button>
    </div>
  );
}
