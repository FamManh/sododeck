# Contract: typed fields API (032)

Model methods and pure helpers. Names may be adjusted during implementation; the behaviour may not.
Every `DeckEditor` call validates first and writes in one transaction (one undo step).

## Pure (`@sododeck/model`, `src/fields.ts`, `src/field-values.ts`)

```ts
type FieldKind =
  'text' | 'number' | 'select' | 'status' | 'person' | 'date' | 'dateRange' | 'link' | 'progress';

interface ResolvedField extends FieldDef {
  source: 'built-in' | 'default' | 'deck';
}

/** Built-ins, then the type's code defaults (unless materialised), then deck fields, in field order. */
function fieldsOfType(deck: SododeckFile, typeId: TypeId): readonly ResolvedField[];
/** Validates one value against its field; returns a message or null. */
function validateValue(field: FieldDef, value: unknown): string | null;
/** Clarify Q2 table; `null` means the value is cleared. */
function convertValue(
  from: FieldDef,
  to: { kind: FieldKind; options?: FieldOption[] },
  value: unknown,
): unknown | null;
/** Values that would be cleared by a kind change (for the confirmation). */
function clearedByKindChange(deck: SododeckFile, fieldId: Id, kind: FieldKind): number;
function personSuggestions(deck: SododeckFile): readonly string[];
function canonicalPerson(deck: SododeckFile, text: string): string;
function fieldUsage(deck: SododeckFile, fieldId: Id, optionId?: Id): number; // cards holding a value
```

## `DeckEditor`

```ts
addField(def: Omit<FieldDef, 'id'>, opts?: { after?: Id }): Id;
updateField(id: Id, patch: Partial<Pick<FieldDef, 'name' | 'types' | 'onCard' | 'unit'>>): void;
moveField(id: Id, beforeId: Id | null): void;
deleteField(id: Id): void;                       // removes every value too; not for built-ins
addOption(fieldId: Id, option: Omit<FieldOption, 'id'>, opts?: { after?: Id }): Id;
updateOption(fieldId: Id, optionId: Id, patch: Partial<Omit<FieldOption, 'id'>>): void;
moveOption(fieldId: Id, optionId: Id, beforeId: Id | null): void;
deleteOption(fieldId: Id, optionId: Id): void;   // clears values using it
changeFieldKind(id: Id, kind: FieldKind): void;  // converts or clears values; not for built-ins
setValues(nodeIds: readonly Id[], fieldId: Id, value: unknown | null): void; // built-ins write tech / host / owner
```

Rules (unit-tested):

- Any op touching a code default field first materialises that type's defaults into `fields` and
  adds the type to `fieldDefaults`, in the same transaction; `setValues` never materialises.
- Names: empty or a duplicate within a type (ignoring case) throws and writes nothing.
- `setValues` validates with `validateValue`; invalid throws and writes nothing; person values
  pass through `canonicalPerson`.
- `deleteField` / `deleteOption` remove the affected values in the same step; undo restores both.
- Built-ins: rename, delete, kind change and options throw; order and `onCard` are allowed.
- A deck that never calls these ops serialises byte-identical to before 032.
