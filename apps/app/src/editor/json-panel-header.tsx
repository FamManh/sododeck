import { Button } from '@sododeck/ui/components/button';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { useToast } from '@sododeck/ui/components/toast';
import { ChevronDown, Copy, Lock, X } from 'lucide-react';

import { copyText, couldNotCopyText } from '../lib/clipboard';
import { isApplePlatform } from '../lib/features';
import type { CodeFormat, JsonTab, SchemaScope } from '../state/json-panel-prefs';
import { CodeFormatTabs } from './code/code-format-tabs';
import { copyToastText, countLines, lineCountLabel, type SelectionView } from './json-panel-view';

export interface JsonPanelHeaderProps {
  /** Format tabs (046): JSON keeps the view switch below; DBML and SQL get the schema scope. */
  format: CodeFormat;
  onFormatChange: (format: CodeFormat) => void;
  schemaScope: SchemaScope;
  onSchemaScopeChange: (scope: SchemaScope) => void;
  tab: JsonTab;
  onTabChange: (tab: JsonTab) => void;
  /** Labels the Selection tab and names what Copy copied. */
  view: SelectionView;
  /** Text of the current tab; `''` when it shows no code. */
  text: string;
  onCollapse: () => void;
  /** Hides the whole overlay (018, ⌘J); absent outside the canvas-first shell. */
  onClose?: () => void;
}

const isSchemaScope = (value: string): value is SchemaScope =>
  value === 'selection' || value === 'schema';

const isTab = (value: string): value is JsonTab => value === 'deck' || value === 'selection';

/** 40 px header of the expanded JSON panel (contracts/json-panel-ui.md, screens 02 and 16). */
export function JsonPanelHeader({
  format,
  onFormatChange,
  schemaScope,
  onSchemaScopeChange,
  tab,
  onTabChange,
  view,
  text,
  onCollapse,
  onClose,
}: JsonPanelHeaderProps) {
  const { toast } = useToast();
  const lineCount = countLines(text);

  const copy = async () => {
    toast({ message: (await copyText(text)) ? copyToastText(tab, view) : couldNotCopyText() });
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-hairline bg-surface pr-2 pl-4">
      <CodeFormatTabs format={format} onChange={onFormatChange} />
      {format === 'json' ? (
        <>
          <SegmentedControl
            aria-label="JSON view"
            value={tab}
            onValueChange={(value) => {
              if (isTab(value)) onTabChange(value);
            }}
          >
            <SegmentedControlItem
              value="selection"
              aria-label={view.fullLabel}
              title={view.fullLabel}
            >
              <span className="max-w-40 truncate">{view.label}</span>
            </SegmentedControlItem>
            <SegmentedControlItem value="deck">Deck</SegmentedControlItem>
          </SegmentedControl>
          <p className="flex min-w-0 items-center gap-1.5 truncate text-caption text-ink-secondary">
            <Lock aria-hidden className="size-3.5 shrink-0" />
            Read-only · synced with canvas
          </p>
        </>
      ) : (
        <SegmentedControl
          aria-label="Schema scope"
          value={schemaScope}
          onValueChange={(value) => {
            if (isSchemaScope(value)) onSchemaScopeChange(value);
          }}
        >
          <SegmentedControlItem value="selection">Selection</SegmentedControlItem>
          <SegmentedControlItem value="schema">Whole schema</SegmentedControlItem>
        </SegmentedControl>
      )}
      <div className="flex-1" />
      {format === 'json' && lineCount > 0 && (
        <span className="font-mono text-caption whitespace-nowrap text-ink-secondary">
          {lineCountLabel(lineCount)}
        </span>
      )}
      {format === 'json' && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy JSON"
          disabled={text === ''}
          onClick={() => {
            void copy();
          }}
        >
          <Copy />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Collapse JSON panel"
        aria-expanded
        onClick={onCollapse}
      >
        <ChevronDown />
      </Button>
      {onClose !== undefined && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close JSON"
          title={`Close JSON · ${isApplePlatform() ? '⌘J' : 'Ctrl+J'}`}
          onClick={onClose}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
