import {
  groupingModeOf,
  relationshipDisplayOf,
  tableDisplayOf,
  type ResolvedRelationshipDisplay,
} from '@sododeck/model';
import type { SododeckFile, TableDisplay } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { Switch } from '@sododeck/ui/components/switch';
import { useId } from 'react';

import { useEditor } from '../../../model/use-editor';
import { oneStep } from '../../fields/one-step';
import { DialectConfirmDialog } from './dialect-confirm-dialog';
import { DialectSelect } from './dialect-select';
import { EnumList } from './enum-list';
import { showsDatabaseSection } from './shows-database-section';

type HideFlag = 'hideTypes' | 'hideNullable' | 'hideNotes' | 'hideIndexes';

const TOGGLES: readonly { flag: HideFlag; label: string }[] = [
  { flag: 'hideTypes', label: 'Data types' },
  { flag: 'hideNullable', label: 'Nullable marker' },
  { flag: 'hideNotes', label: 'Notes' },
  { flag: 'hideIndexes', label: 'Index footer' },
];

const LABEL_MODES: readonly { value: ResolvedRelationshipDisplay['labels']; label: string }[] = [
  { value: 'follow', label: 'Follow Labels tool' },
  { value: 'hover', label: 'On hover' },
  { value: 'always', label: 'Always' },
  { value: 'off', label: 'Off' },
];

/**
 * Deck settings › Database tab (041 FR-019, FR-020, 052, frame 152): the deck dialect, "Show on
 * tables" and four switches, all on by default; each writes one hide flag of `tableDisplay` in
 * one undo step. 042 adds "Show on relationships"; 052 adds the dialect, the enums list and the
 * block-SQL-export switch.
 */
export function DatabaseSection({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const id = useId();
  if (!showsDatabaseSection(deck)) return null;
  const display = tableDisplayOf(deck);
  return (
    <PanelSection>
      <DialectSelect deck={deck} />
      <p className="text-caption text-ink-secondary">
        One dialect for every table and database card in this deck.
      </p>
      <DialectConfirmDialog />
      <span id={`${id}-heading`} className="text-caption font-medium text-ink-secondary">
        Show on tables
      </span>
      <ul aria-labelledby={`${id}-heading`} className="flex flex-col gap-1">
        {TOGGLES.map(({ flag, label }) => (
          <li key={flag} className="flex h-8 items-center justify-between gap-3">
            <label htmlFor={`${id}-${flag}`} className="text-body-sm text-ink">
              {label}
            </label>
            <Switch
              id={`${id}-${flag}`}
              checked={!display[flag]}
              onCheckedChange={(checked) => {
                const patch: Pick<TableDisplay, HideFlag> = { [flag]: !checked };
                oneStep(editor, () => {
                  editor.setTableDisplay(patch);
                });
              }}
            />
          </li>
        ))}
      </ul>
      <GroupingControl deck={deck} />
      <RelationshipDisplayControls deck={deck} />
      <EnumList deck={deck} />
      <BlockSqlExportSwitch deck={deck} />
    </PanelSection>
  );
}

/**
 * "Show on relationships" (042 FR-025, R16): cardinality ends, label visibility and notation,
 * each written to `relationshipDisplay` in one undo step; defaults are removed from the file.
 */
function RelationshipDisplayControls({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const id = useId();
  const display = relationshipDisplayOf(deck);
  const write = (patch: Parameters<typeof editor.setRelationshipDisplay>[0]) => {
    oneStep(editor, () => {
      editor.setRelationshipDisplay(patch);
    });
  };
  return (
    <>
      <span id={`${id}-heading`} className="pt-2 text-caption font-medium text-ink-secondary">
        Show on relationships
      </span>
      <div role="group" aria-labelledby={`${id}-heading`} className="flex flex-col gap-1">
        <div className="flex h-8 items-center justify-between gap-3">
          <label htmlFor={`${id}-ends`} className="text-body-sm text-ink">
            Cardinality ends
          </label>
          <Switch
            id={`${id}-ends`}
            checked={!display.hideEnds}
            onCheckedChange={(checked) => {
              write({ hideEnds: checked ? null : true });
            }}
          />
        </div>
        <div className="flex h-8 items-center justify-between gap-3">
          <span id={`${id}-labels`} className="text-body-sm text-ink">
            Labels
          </span>
          <Select
            value={display.labels}
            onValueChange={(value) => {
              const mode = LABEL_MODES.find((m) => m.value === value)?.value ?? 'follow';
              write({ labels: mode === 'follow' ? null : mode });
            }}
          >
            <SelectTrigger aria-labelledby={`${id}-labels`} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LABEL_MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex h-8 items-center justify-between gap-3">
          <span id={`${id}-notation`} className="text-body-sm text-ink">
            Notation
          </span>
          <SegmentedControl
            aria-labelledby={`${id}-notation`}
            value={display.notation}
            onValueChange={(value) => {
              write({ notation: value === 'numeric' ? 'numeric' : null });
            }}
          >
            <SegmentedControlItem value="crow">Crow&apos;s foot</SegmentedControlItem>
            <SegmentedControlItem value="numeric">1 / n</SegmentedControlItem>
          </SegmentedControl>
        </div>
      </div>
    </>
  );
}

/** "Group tables" (048, ADR 0034): the deck-wide grouping mode, one undo step per change. */
function GroupingControl({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const id = useId();
  return (
    <div className="flex h-8 items-center justify-between gap-3 pt-2">
      <span id={`${id}-grouping`} className="text-body-sm text-ink">
        Group tables
      </span>
      <SegmentedControl
        aria-labelledby={`${id}-grouping`}
        value={groupingModeOf(deck)}
        onValueChange={(value) => {
          oneStep(editor, () => {
            editor.setGroupingMode(value === 'schema' ? 'schema' : null);
          });
        }}
      >
        <SegmentedControlItem value="group">By group</SegmentedControlItem>
        <SegmentedControlItem value="schema">By schema</SegmentedControlItem>
      </SegmentedControl>
    </div>
  );
}

/** "Block SQL export with errors" (052 US6): the export dialog reads it; DBML and the rest export. */
function BlockSqlExportSwitch({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <div className="flex min-w-0 flex-col">
        <label htmlFor={id} className="text-body-sm text-ink">
          Block SQL export with errors
        </label>
        <span id={`${id}-help`} className="text-caption text-ink-secondary">
          DBML, Mermaid and JSON still export
        </span>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-help`}
        checked={deck.blockSqlExport === true}
        onCheckedChange={(checked) => {
          oneStep(editor, () => {
            editor.setBlockSqlExport(checked);
          });
        }}
      />
    </div>
  );
}
