/**
 * The drawer's "Fields" section (032 US1, US3, US4; frame 124): one list of the card type's
 * fields (its defaults, deck fields, then Tech / Host / Owner) with a value control each, the
 * "On card" switch, the row menu and "Add field". With several cards selected it edits them all
 * at once: differing values read "Mixed" (FR-016); mixed types list only fields every card has.
 */
import { personSuggestions, valueOf, type ResolvedField } from '@sododeck/model';
import type { Node, SododeckFile } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { AddFieldForm } from './add-field-form';
import { FieldRow } from './field-row';
import { tryFieldEdit } from './field-writes';
import { sameValue, sharedFields } from './shared-fields';

export function TypedFieldsSection({
  deck,
  nodes,
}: {
  deck: SododeckFile;
  nodes: readonly Node[];
}) {
  const editor = useEditor();
  const announce = useUiStore((s) => s.announce);
  const section = useUiStore((s) => s.drawerSection);
  const heading = useRef<HTMLHeadingElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fields = useMemo(() => sharedFields(deck, nodes), [deck, nodes]);
  const people = useMemo(() => personSuggestions(deck), [deck]);
  const type = nodes[0]?.type;
  const oneType = type !== undefined && nodes.every((node) => node.type === type);
  const ids = nodes.map((node) => node.id);

  useEffect(() => {
    if (section !== 'fields') return;
    const target = heading.current;
    // jsdom has no scrollIntoView.
    if (target !== null && 'scrollIntoView' in target) target.scrollIntoView({ block: 'start' });
    target?.focus();
    useUiStore.getState().clearDrawerSection();
  }, [section]);

  const move = (field: ResolvedField, beforeId: string | null) => {
    if (type === undefined) return;
    setError(
      tryFieldEdit(editor, () => {
        editor.moveField(field.id, beforeId, type);
      }),
    );
  };
  const moveBy = (index: number, direction: -1 | 1) => {
    const field = fields[index];
    if (field === undefined) return;
    if (direction === -1) {
      const before = fields[index - 1];
      if (before === undefined) return;
      move(field, before.id);
      announce(`${field.name} moved up`);
    } else {
      if (index === fields.length - 1) return;
      move(field, fields[index + 2]?.id ?? null);
      announce(`${field.name} moved down`);
    }
  };
  const dropOn = (targetId: string, event: DragEvent) => {
    event.preventDefault();
    const from = fields.findIndex((f) => f.id === dragging);
    const to = fields.findIndex((f) => f.id === targetId);
    const field = fields[from];
    setOver(null);
    setDragging(null);
    if (field === undefined || to === -1 || from === to) return;
    // Dropping on a row puts the field in its place: before it going up, after it going down.
    move(field, from > to ? targetId : (fields[to + 1]?.id ?? null));
  };

  return (
    <PanelSection>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h3
            ref={heading}
            tabIndex={-1}
            className="text-micro text-ink-muted uppercase outline-none"
          >
            Fields
          </h3>
          {oneType && fields.length > 0 && (
            <span aria-hidden className="text-micro text-ink-muted uppercase">
              On card
            </span>
          )}
        </div>
        {fields.length > 0 && (
          <ul aria-label="Fields" className="flex flex-col">
            {fields.map((field, index) => {
              const values = nodes.map((node) => valueOf(node, field.id));
              const mixed = values.some((value) => !sameValue(value, values[0]));
              return (
                <FieldRow
                  key={field.id}
                  deck={deck}
                  field={field}
                  value={mixed ? undefined : values[0]}
                  mixed={mixed}
                  bulkHint={
                    nodes.length < 2
                      ? undefined
                      : mixed
                        ? 'Mixed values'
                        : sameValue(values[0], undefined)
                          ? undefined
                          : `Same on all ${String(nodes.length)}`
                  }
                  people={people}
                  editable={oneType}
                  onCommit={(value) => {
                    setError(
                      tryFieldEdit(editor, () => {
                        editor.setValues(ids, field.id, value);
                      }),
                    );
                  }}
                  onMove={(direction) => {
                    moveBy(index, direction);
                  }}
                  drag={{
                    over: over === field.id && dragging !== field.id,
                    onStart: setDragging,
                    onOver: (id, event) => {
                      if (dragging === null) return;
                      event.preventDefault();
                      setOver(id);
                    },
                    onDrop: dropOn,
                    onEnd: () => {
                      setDragging(null);
                      setOver(null);
                    },
                  }}
                />
              );
            })}
          </ul>
        )}
        {error !== null && (
          <p role="alert" className="text-caption text-clay-ink">
            {error}
          </p>
        )}
        {oneType && <AddFieldForm typeId={type} />}
      </div>
    </PanelSection>
  );
}
