import type { Id, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { PanelSection } from '@sododeck/ui/components/panel';
import { SwatchGrid, type SwatchOption } from '@sododeck/ui/components/swatch-grid';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { List, MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { renameEnum } from '../../../db/enum-edits';
import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { ConfirmDialog } from '../../fields/confirm-dialog';
import { FieldLabel } from '../../fields/field-label';
import { oneStep } from '../../fields/one-step';
import { CARD_COLORS, colourName } from '../../style/card-style';
import { useUndoToast } from '../../undo-toast';
import { InspectorFrame } from '../inspector-frame';
import { LiveTextField } from '../table/live-text-field';
import { EnumUsedBy } from './enum-used-by';
import { enumUsers } from './enum-users';
import { EnumValues } from './enum-values';

const NO_COLOUR = 'none';

/** The message for an enum that would share `name` with another one in `schema`, else none. */
function duplicateEnum(
  deck: SododeckFile,
  enumId: Id,
  name: string,
  schema: string | undefined,
): string | undefined {
  const key = name.toLowerCase();
  const clash = (deck.enums ?? []).some(
    (e) => e.id !== enumId && e.name.toLowerCase() === key && (e.schema ?? '') === (schema ?? ''),
  );
  return clash
    ? `An enum named ${name} already exists in ${schema ?? 'the default schema'}`
    : undefined;
}

/**
 * The enum drawer (052 US4, frame 165): name, schema, colour, note, the values and the columns
 * that use it. A rename also renames the type text of linked columns in the same step; deleting
 * an enum in use asks first and keeps the columns' type text.
 */
export function EnumInspector({ deck, enumId }: { deck: SododeckFile; enumId: Id }) {
  const editor = useEditor();
  const undoToast = useUndoToast();
  const base = useId();
  const [confirming, setConfirming] = useState(false);
  const selectName = useUiStore((s) => s.enumNameSelect === enumId);
  useEffect(() => {
    if (selectName) useUiStore.setState({ enumNameSelect: null });
  }, [selectName]);
  const dbEnum = deck.enums?.find((e) => e.id === enumId);
  if (dbEnum === undefined) return null;

  const n = dbEnum.values.length;
  const users = enumUsers(deck, enumId);
  const swatches: SwatchOption[] = [
    { value: NO_COLOUR, label: 'No colour', swatch: 'var(--color-border)' },
    ...CARD_COLORS.map((name) => ({
      value: name,
      label: colourName(name),
      swatch: `var(--color-card-${name}-stroke)`,
    })),
  ];

  const remove = () => {
    setConfirming(false);
    oneStep(editor, () => {
      editor.removeEnum(enumId);
    });
    undoToast(`Deleted enum ${dbEnum.name}`);
    useUiStore.getState().closeDrawer();
  };

  return (
    <InspectorFrame
      icon={<List aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={dbEnum.name}
      subtitle={`Enum · ${String(n)} value${n === 1 ? '' : 's'}`}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Enum options">
              <MoreHorizontal aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                if (users.length === 0) remove();
                else setConfirming(true);
              }}
            >
              <Trash2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
              Delete enum
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div key={enumId} className="contents">
        <PanelSection className="grid grid-cols-2 gap-3">
          <LiveTextField
            label="Name"
            required
            mono
            autoSelect={selectName}
            value={dbEnum.name}
            validate={(text) => duplicateEnum(deck, enumId, text, dbEnum.schema)}
            onWrite={(name) => {
              renameEnum(editor, deck, enumId, name);
            }}
          />
          <LiveTextField
            label="Schema"
            placeholder="Default"
            value={dbEnum.schema ?? ''}
            validate={(text) =>
              duplicateEnum(deck, enumId, dbEnum.name, text === '' ? undefined : text)
            }
            onWrite={(text) => {
              editor.updateEnum(enumId, { schema: text === '' ? null : text });
            }}
          />
        </PanelSection>
        <PanelSection>
          <FieldLabel id={`${base}-colour`}>Colour</FieldLabel>
          <SwatchGrid
            label="Colour"
            options={swatches}
            value={dbEnum.color === undefined ? null : dbEnum.color}
            columns={7}
            onSelect={(value) => {
              const next = value === NO_COLOUR ? null : value;
              oneStep(editor, () => {
                editor.updateEnum(enumId, { color: next });
              });
            }}
          />
        </PanelSection>
        <PanelSection>
          <LiveTextField
            label="Note"
            multiline
            placeholder="What is this enum for?"
            value={dbEnum.note ?? ''}
            onWrite={(text) => {
              editor.updateEnum(enumId, { note: text === '' ? null : text });
            }}
          />
        </PanelSection>
        <PanelSection label="Values">
          <EnumValues deck={deck} dbEnum={dbEnum} />
        </PanelSection>
        <PanelSection label="Used by">
          <EnumUsedBy deck={deck} enumId={enumId} />
        </PanelSection>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Delete enum?"
        body={`Delete ${dbEnum.name}? ${String(users.length)} column${users.length === 1 ? '' : 's'} ${users.length === 1 ? 'uses' : 'use'} it and keep${users.length === 1 ? 's' : ''} ${dbEnum.name} as plain type text.`}
        confirmLabel="Delete enum"
        onConfirm={remove}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </InspectorFrame>
  );
}
