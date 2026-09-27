/** Folder name rules (FR-019, data-model.md). Pure; shared by the database and the UI. */

export const FOLDER_NAME_MAX = 60;

export type FolderNameError = 'empty' | 'duplicate' | 'too-long';

/** The comparison key: trimmed, lower-case. "Payments" and " payments " are the same folder. */
export function folderNameKey(name: string): string {
  return name.trim().toLocaleLowerCase('en');
}

/** `null` when `name` can be used; `existingKeys` are the keys of the other live folders. */
export function validateFolderName(
  name: string,
  existingKeys: Iterable<string>,
): FolderNameError | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'empty';
  if (trimmed.length > FOLDER_NAME_MAX) return 'too-long';
  const key = folderNameKey(trimmed);
  for (const existing of existingKeys) if (existing === key) return 'duplicate';
  return null;
}

/** The inline error text under the field (contracts/library-ui.md). */
export function folderNameMessage(error: FolderNameError, name: string): string {
  switch (error) {
    case 'empty':
      return 'Enter a folder name.';
    case 'duplicate':
      return `A folder named "${name.trim()}" already exists.`;
    case 'too-long':
      return `Use ${String(FOLDER_NAME_MAX)} characters or fewer.`;
  }
}
