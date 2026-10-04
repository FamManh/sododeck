/**
 * A file-name slug (012): lower case, Unicode letters and digits kept, every other run of
 * characters a single `-`, at most 80 characters. Empty when nothing is left.
 */
export function slug(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '');
}
