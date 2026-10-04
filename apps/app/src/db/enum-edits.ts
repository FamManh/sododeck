/**
 * Enum edits that reach into columns (052 research R7). `updateEnum` itself never touches columns,
 * so these helpers group the cross-object writes into one `editor.batch`: one undo step each.
 * They take the editor and a snapshot, no React, like 043's `deleteColumn`.
 */
import type { DeckEditor } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

type ColumnOf = NonNullable<SododeckFile['nodes'][number]['columns']>[number];

/** Every column whose `enumRef` is the enum, in deck order. */
function linkedColumns(deck: SododeckFile, enumId: Id): { tableId: Id; column: ColumnOf }[] {
  return deck.nodes.flatMap((node) =>
    (node.columns ?? [])
      .filter((column) => column.enumRef === enumId)
      .map((column) => ({ tableId: node.id, column })),
  );
}

/** Renames the enum and the type text of its linked columns together (clarify Q2). */
export function renameEnum(editor: DeckEditor, deck: SododeckFile, enumId: Id, name: string): void {
  editor.batch(() => {
    editor.updateEnum(enumId, { name });
    for (const { tableId, column } of linkedColumns(deck, enumId)) {
      editor.updateColumn(tableId, column.id, { type: name });
    }
  });
}

/** Renames a value and the defaults of linked columns that used the old name (frame 165). */
export function renameEnumValue(
  editor: DeckEditor,
  deck: SododeckFile,
  enumId: Id,
  valueId: Id,
  name: string,
): void {
  const old = deck.enums?.find((e) => e.id === enumId)?.values.find((v) => v.id === valueId)?.name;
  editor.batch(() => {
    editor.updateEnumValue(enumId, valueId, { name });
    if (old === undefined) return;
    for (const { tableId, column } of linkedColumns(deck, enumId)) {
      if (column.default === old) editor.updateColumn(tableId, column.id, { default: name });
    }
  });
}

/** `enum_1`, or the first `enum_n` not taken (case-insensitive). */
export function nextEnumName(enums: readonly { name: string }[]): string {
  const taken = new Set(enums.map((e) => e.name.toLowerCase()));
  let n = 1;
  while (taken.has(`enum_${String(n)}`)) n += 1;
  return `enum_${String(n)}`;
}

/**
 * Adds an empty enum named `enum_n`; with `linkColumn`, links that column to it (`enumRef` and
 * `type`) in the same step. Returns the new id so the caller can open the enum drawer.
 */
export function createEnum(
  editor: DeckEditor,
  deck: SododeckFile,
  options: { linkColumn?: { tableId: Id; columnId: Id } } = {},
): Id {
  const name = nextEnumName(deck.enums ?? []);
  return editor.batch(() => {
    const id = editor.addEnum({ name, values: [] });
    if (options.linkColumn !== undefined) {
      const { tableId, columnId } = options.linkColumn;
      editor.updateColumn(tableId, columnId, { enumRef: id, type: name });
    }
    return id;
  });
}
