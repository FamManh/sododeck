import { typeName, type ResolvedField } from '@sododeck/model';

/** "Applies to every Task", "… every Task and Issue", "… every card" (FR-006). */
export function appliesText(field: ResolvedField): string {
  const types = field.types;
  if (types === undefined) return 'Applies to every card';
  const names = types.map(typeName);
  const list =
    names.length <= 1
      ? (names[0] ?? '')
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
  return `Applies to every ${list}`;
}
