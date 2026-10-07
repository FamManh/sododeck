import type { ImageFlowNode } from '../deck-to-flow';

/** What a person hears for an image: its alt text, else its file name (contracts/ui.md). */
export function imageName(
  data: ImageFlowNode['data'],
  missing: boolean,
  /** Why the picture is missing, when its store says (a host program does, 067). */
  reason?: string,
): string {
  const label = data.alt !== undefined && data.alt !== '' ? data.alt : data.fileName;
  const parts = [`Image: ${label === '' ? 'untitled' : label}`];
  if (data.filePath !== undefined)
    parts.push(`picture missing, saved as a separate file: ${data.filePath}`);
  else if (missing)
    parts.push(reason === undefined ? 'picture missing' : `picture missing: ${reason}`);
  if (data.locked) parts.push('locked');
  return parts.join(', ');
}
